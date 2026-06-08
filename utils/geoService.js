/**
 * Utility to track User Geolocation based on IP address using the free ip-api.com service.
 * Free tier limits: 45 requests per minute. NO API Key needed.
 */
async function getGeoLocation(ipAddress) {
  try {
    // 1. Clean the IP address
    let cleanIp = ipAddress;
    
    // In local development or proxies, IP might look like "::1" or "::ffff:192.168.1.1" or "127.0.0.1, 10.0.0.1"
    if (cleanIp) {
      if (cleanIp.includes(",")) {
        cleanIp = cleanIp.split(",")[0].trim();
      }
      if (cleanIp.startsWith("::ffff:")) {
        cleanIp = cleanIp.replace("::ffff:", "");
      }
      // If localhost, mock an Indian IP for local testing purposes (e.g. an Airtel IP in Delhi)
      if (cleanIp === "::1" || cleanIp === "127.0.0.1") {
        cleanIp = "125.16.1.1"; 
      }
    } else {
      return null;
    }

    // 2. Call the free IP-API service over standard HTTP
    // Important: HTTPS is a premium feature on ip-api.com, so we use http.
    const url = `http://ip-api.com/json/${cleanIp}`;
    
    const response = await fetch(url, {
      method: "GET",
      // Set a short timeout so we don't stall user logins if the API is down
      signal: AbortSignal.timeout(3000) 
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    // 3. Return formatted location object if successful
    if (data.status === "success") {
      return {
        ip: cleanIp,
        city: data.city,
        region: data.regionName,
        country: data.country,
        lat: data.lat,
        lon: data.lon,
        isp: data.isp,
        updatedAt: new Date()
      };
    }
    
    return null;
  } catch (error) {
    console.warn(`⚠️ [GeoService] Failed to fetch geolocation for IP: ${ipAddress}`, error.message);
    return null;
  }
}

/**
 * Helper to extract IP from an Express request object
 */
function extractIp(req) {
  return req.headers["x-forwarded-for"] || req.connection?.remoteAddress || req.socket?.remoteAddress || req.ip || null;
}

module.exports = {
  getGeoLocation,
  extractIp
};
