export function parseHostTarget(input: string) {
  try {
    const normalized = input.match(/^https?:\/\//) ? input : `http://${input}`;
    const url = new URL(normalized);

    const protocol = url.protocol.replace(":", ""); // http | https
    const host = url.hostname;
    const port = url.port ? parseInt(url.port, 10) : protocol === "https" ? 443 : 80;

    return { protocol, host, port };
  } catch {
    return null;
  }
}

