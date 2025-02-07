const map = L.map('map').setView([0.3375122, 32.5808939], 20);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);
const marker = L.marker([0.3375122, 32.5808939]).addTo(map);
marker.bindPopup('Location: 0.3375122, 32.5808939').openPopup();
