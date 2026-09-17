export default {
  async fetch(request) {
    const url = new URL(request.url);
    const targetUrl = new URL(url.pathname + url.search, "https://axiom-docs-a0n.pages.dev");
    return fetch(targetUrl.toString(), request);
  }
};
