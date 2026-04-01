(async function () {
    var DEFAULT_LOCATION_NAME = "United States";

    function setLocationName(name) {
        var finalName = (name || DEFAULT_LOCATION_NAME).toUpperCase();

        document.querySelectorAll("#location").forEach(function (span) {
            span.textContent = finalName;
        });

        document.querySelectorAll("#heroLocation").forEach(function (span) {
            span.textContent = finalName;
        });

        console.log("[geotarget] Location set to:", finalName);
    }

    function parseCSVLine(line) {
        var result = [];
        var current = "";
        var inQuotes = false;

        for (var i = 0; i < line.length; i++) {
            var ch = line[i];

            if (inQuotes) {
                if (ch === '"') {
                    if (i + 1 < line.length && line[i + 1] === '"') {
                        current += '"';
                        i++;
                    } else {
                        inQuotes = false;
                    }
                } else {
                    current += ch;
                }
            } else {
                if (ch === '"') {
                    inQuotes = true;
                } else if (ch === ",") {
                    result.push(current.trim());
                    current = "";
                } else {
                    current += ch;
                }
            }
        }

        result.push(current.trim());
        return result;
    }

    function fastCSVLookup(csv, locationId) {
        var firstNewline = csv.indexOf("\n");
        if (firstNewline === -1) return null;

        var headerLine = csv.substring(0, firstNewline).replace(/\r$/, "");
        var headers = parseCSVLine(headerLine).map(function (h) { return h.toLowerCase(); });

        var searchPatterns = [
            '"' + locationId + '"',
            "," + locationId + ",",
            "\n" + locationId + ","
        ];

        var lineStart = -1;
        for (var p = 0; p < searchPatterns.length; p++) {
            var idx = csv.indexOf(searchPatterns[p]);
            if (idx !== -1) {
                lineStart = csv.lastIndexOf("\n", idx);
                if (lineStart === -1) lineStart = 0;
                else lineStart += 1;
                break;
            }
        }

        if (lineStart === -1) return null;

        var lineEnd = csv.indexOf("\n", lineStart);
        if (lineEnd === -1) lineEnd = csv.length;
        var line = csv.substring(lineStart, lineEnd).replace(/\r$/, "");

        var cols = parseCSVLine(line);
        var row = {};
        headers.forEach(function (h, idx) { row[h] = cols[idx] || ""; });

        var rowId =
            row["criteria id"] ||
            row["criteria_id"] ||
            row["location"] ||
            row["location_id"] ||
            row["locationid"] ||
            row["id"] ||
            "";

        if (String(rowId) !== String(locationId)) return null;

        return (
            row["city"] ||
            row["city_name"] ||
            row["name"] ||
            row["location_name"] ||
            row["region"] ||
            row["state"] ||
            row["country"] ||
            null
        );
    }

    /**
     * Try geo.php FIRST (reads Cloudflare headers on WP Engine — works on all devices),
     * then fall back to free IP geolocation APIs.
     */
    async function getIPLocation() {
        var apis = [
            // PRIMARY: geo.php on same server — reads Cloudflare geo headers
            // No rate limits, no CORS issues, works on mobile
            {
                url: "geo.php",
                parse: function (d) { return d.city || d.region || d.locationName; }
            },
            // Fallback 1: ipapi.co (supports HTTPS, 1k/day free)
            {
                url: "https://ipapi.co/json/",
                parse: function (d) { return d.city || d.region || d.country_name; }
            },
            // Fallback 2: ipwho.is
            {
                url: "https://ipwho.is/",
                parse: function (d) { return d.city || d.region || d.country; }
            },
            // Fallback 3: freeipapi.com
            {
                url: "https://freeipapi.com/api/json",
                parse: function (d) { return d.cityName || d.regionName || d.countryName; }
            }
            // REMOVED: ip-api.com — free tier does NOT support HTTPS, always fails
        ];

        for (var i = 0; i < apis.length; i++) {
            try {
                console.log("[geotarget] Trying:", apis[i].url);
                var res = await fetch(apis[i].url, { cache: "no-store" });
                if (!res.ok) throw new Error(res.status);
                var data = await res.json();
                var name = apis[i].parse(data);
                if (name) {
                    console.log("[geotarget] Success from", apis[i].url, "→", name);
                    return name;
                }
            } catch (e) {
                console.warn("[geotarget] Failed:", apis[i].url, e.message || e);
            }
        }

        return null;
    }

    // 1) If URL has ?location=xxxx, use locations.csv
    var params = new URLSearchParams(window.location.search);
    var locationId = params.get("location");

    if (locationId) {
        console.log("[geotarget] Looking up location ID:", locationId);

        try {
            var csvRes = await fetch("locations.csv", { cache: "no-store" });
            if (!csvRes.ok) throw new Error("Failed to load locations.csv (" + csvRes.status + ")");

            var csv = await csvRes.text();
            console.log("[geotarget] CSV loaded, size:", csv.length, "chars");

            var foundName = fastCSVLookup(csv, locationId);
            setLocationName(foundName || DEFAULT_LOCATION_NAME);
            return;
        } catch (e) {
            console.error("[geotarget] CSV lookup failed:", e);
            setLocationName(DEFAULT_LOCATION_NAME);
            return;
        }
    }

    // 2) No ?location= → use IP geolocation with fallbacks
    console.log("[geotarget] No location param, trying IP geolocation...");

    var city = await getIPLocation();
    setLocationName(city || DEFAULT_LOCATION_NAME);
})();