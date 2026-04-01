export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/treecare") || 
        url.pathname.startsWith("/assets/") ||
        url.pathname.startsWith("/submit-form") ||
        url.pathname.startsWith("/thank-you") ||
        url.pathname.startsWith("/form-error")) {
      
      const targetUrl = "https://arbor-centric-lp-trujc.ondigitalocean.app" + url.pathname + url.search;
      
      try {
        const response = await fetch(targetUrl, {
          method: request.method,
          body: request.method !== "GET" && request.method !== "HEAD" ? await request.arrayBuffer() : null,
          headers: {
            "Content-Type": request.headers.get("Content-Type") || "",
          },
          redirect: "manual",
        });
        return response;
      } catch(e) {
        return new Response("Error: " + e.message, { status: 500 });
      }
    }
    return fetch(request);
  }
}