import forge from "node-forge";
import fs from "node:fs";
import path from "node:path";

export interface CA {
  key: forge.pki.rsa.PrivateKey;
  cert: forge.pki.Certificate;
  keyPem: string;
  certPem: string;
}

export async function loadOrCreateCA(certsDir: string): Promise<CA> {
  const keyPath = path.join(certsDir, "ca.key.pem");
  const certPath = path.join(certsDir, "ca.cert.pem");

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    const keyPem = fs.readFileSync(keyPath, "utf8");
    const certPem = fs.readFileSync(certPath, "utf8");
    const key = forge.pki.privateKeyFromPem(keyPem);
    const cert = forge.pki.certificateFromPem(certPem);

    // Check expiry
    const now = new Date();
    if (cert.validity.notAfter > now) {
      return { key, cert, keyPem, certPem };
    }
    console.log("[CA] Certificate expired, regenerating...");
  }

  console.log("[CA] Generating new CA certificate...");
  fs.mkdirSync(certsDir, { recursive: true });

  const keypair = await new Promise<forge.pki.rsa.KeyPair>((resolve, reject) => {
    forge.pki.rsa.generateKeyPair({ bits: 2048, workers: 2 }, (err, kp) => {
      if (err) reject(err);
      else resolve(kp);
    });
  });

  const cert = forge.pki.createCertificate();
  cert.publicKey = keypair.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);

  const attrs = [
    { name: "commonName", value: "Tapwire CA" },
    { name: "organizationName", value: "Tapwire" },
    { shortName: "C", value: "KR" },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([
    { name: "basicConstraints", cA: true, pathLenConstraint: 0 },
    { name: "keyUsage", keyCertSign: true, cRLSign: true, critical: true },
    { name: "subjectKeyIdentifier" },
  ]);

  cert.sign(keypair.privateKey, forge.md.sha256.create());

  const keyPem = forge.pki.privateKeyToPem(keypair.privateKey);
  const certPem = forge.pki.certificateToPem(cert);

  fs.writeFileSync(keyPath, keyPem, { mode: 0o600 });
  fs.writeFileSync(certPath, certPem, { mode: 0o644 });

  console.log("[CA] Generated CA certificate:", certPath);
  return { key: keypair.privateKey, cert, keyPem, certPem };
}
