import crypto from 'crypto';

export class MapGenerator {
  static generateMapHTML(lat, lon, zoom = 19) {
    const nonce = crypto.randomBytes(16).toString('base64');
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Location Map</title>
    <meta http-equiv="Content-Security-Policy" content="script-src 'self' 'nonce-${nonce}';">
     <link rel="stylesheet" href="../assets/leaflet.css" />
    <script src="../assets/leaflet.js"></script>
    <style>
        body, html { margin: 0; padding: 0; height: 100%; }
        #map { height: 100vh; width: 100%; }
    </style>
</head>
<body>
    <div id="map"></div>
    <script nonce="${nonce}">
        const map = L.map('map').setView([${lat}, ${lon}], ${zoom});
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);
        const marker = L.marker([${lat}, ${lon}]).addTo(map);
        marker.bindPopup('Location: ${lat}, ${lon}').openPopup();
    </script>
</body>
</html>`;
  }
}
