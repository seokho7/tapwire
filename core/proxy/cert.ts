import forge from "node-forge";
import type { CA } from "./ca.js";

export interface HostCert {
  key: string;
  cert: string;
}

export async function createCertForHost(host: string, ca: CA): Promise<HostCert> {
  const keypair = await new Promise<forge.pki.rsa.KeyPair>((resolve, reject) => {
    forge.pki.rsa.generateKeyPair({ bits: 2048, workers: 2 }, (err, kp) => {
      if (err) reject(err);
      else resolve(kp);
    });
  });

  const cert = forge.pki.createCertificate();
  cert.publicKey = keypair.publicKey;
  cert.serialNumber = Date.now().toString(16);
  cert.validity.notBefore = new Date();
  cert.validity.notBefore.setDate(cert.validity.notBefore.getDate() - 1);
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notAfter.getFullYear() + 1);

  const attrs = [
    { name: "commonName", value: host },
    { name: "organizationName", value: "Tapwire" },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(ca.cert.subject.attributes);

  const altNames: Array<{ type: number; value: string }> = [
    { type: 2, value: host },
  ];

  // Add wildcard for subdomains
  const parts = host.split(".");
  if (parts.length > 2) {
    altNames.push({ type: 2, value: "*." + parts.slice(1).join(".") });
  }

  cert.setExtensions([
    { name: "basicConstraints", cA: false },
    { name: "keyUsage", digitalSignature: true, keyEncipherment: true, critical: true },
    { name: "extKeyUsage", serverAuth: true, clientAuth: true },
    { name: "subjectAltName", altNames },
  ]);

  cert.sign(ca.key, forge.md.sha256.create());

  return {
    key: forge.pki.privateKeyToPem(keypair.privateKey),
    cert: forge.pki.certificateToPem(cert),
  };
}
