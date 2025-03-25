// Inicializar o mapa com Leaflet
let map = L.map('map').setView([-22.92048625354668, -43.17458379592426], 11); // Coordenadas iniciais e zoom ajustado para cidade
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Função para criar ícones personalizados
function createCustomIcon(color) {
    return L.divIcon({
        className: 'custom-icon',
        html: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white;"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
}

// Função para calcular a distância entre dois pontos (em km)
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Raio da Terra em km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Função para obter o endereço do ponto principal usando Nominatim (geocodificação reversa)
async function getMainPointAddress(lat, lng) {
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    try {
        const response = await fetch(nominatimUrl, {
            headers: {
                'User-Agent': 'MOVI SOS Dashboard (seu-email@exemplo.com)' // Substitua pelo seu email
            }
        });
        const data = await response.json();
        return data.display_name || 'Endereço não encontrado';
    } catch (error) {
        console.error('Erro ao buscar endereço do ponto principal:', error);
        return 'Erro ao buscar endereço';
    }
}

// Função para buscar lugares próximos usando a Overpass API
async function fetchNearbyPlaces(lat, lng, type, tags) {
    const radius = 15000; // em metros
    const overpassUrl = `https://overpass-api.de/api/interpreter`;

    const query = `
        [out:json];
        (
            node(around:${radius},${lat},${lng})${tags};
            way(around:${radius},${lat},${lng})${tags};
            relation(around:${radius},${lat},${lng})${tags};
        );
        out center;
    `;

    try {
        const response = await fetch(overpassUrl, {
            method: 'POST',
            body: query
        });
        const data = await response.json();

        console.log(`Resultados para ${type}: ${data.elements.length} encontrados`, data.elements); // Log para depuração

        return data.elements.map(element => {
            const pointLat = element.type === 'node' ? element.lat : element.center.lat;
            const pointLng = element.type === 'node' ? element.lon : element.center.lon;

            return {
                type: type,
                name: element.tags.name || 'Desconhecido',
                lat: pointLat,
                lng: pointLng,
                address: element.tags.address || element.tags['addr:street'] || 'Endereço não disponível',
                phone: element.tags.phone || element.tags.contact || 'Não disponível',
                distance: calculateDistance(lat, lng, pointLat, pointLng)
            };
        });
    } catch (error) {
        console.error(`Erro ao buscar ${type}:`, error);
        return [];
    }
}

// Função para fechar a caixa de endereço
function closeAddressBox() {
    document.getElementById('main-point-address').style.display = 'none';
}

// Função para limpar o formulário e o mapa
function resetForm() {
    document.getElementById('coords').value = '';
    map.eachLayer(layer => {
        if (layer instanceof L.Marker) {
            map.removeLayer(layer);
        }
    });
    document.getElementById('main-point-address').style.display = 'none';
    ['hospital-list', 'police-list', 'firefighter-list', 'locksmith-list', 'mechanic-list'].forEach(id => {
        document.getElementById(id).innerHTML = '';
    });
    map.setView([-22.92048625354668, -43.17458379592426], 11); // Volta para a visão inicial
}

// Função para buscar e exibir a localização
async function searchLocation() {
    const coordsInput = document.getElementById('coords').value.trim();
    
    const coords = coordsInput.split(',').map(coord => parseFloat(coord.trim()));
    
    if (coords.length !== 2 || isNaN(coords[0]) || isNaN(coords[1])) {
        alert('Por favor, insira coordenadas válidas no formato: latitude
