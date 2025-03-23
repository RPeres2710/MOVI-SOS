// Inicializar o mapa
let map = L.map('map').setView([-23.5505, -46.6333], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

// Marcador para o ponto de acionamento
let marker = null;
// Lista para armazenar marcadores de pontos de apoio
let supportMarkers = [];
// Objeto para armazenar os pontos mais próximos com números de contato
let nearestSupportPoints = {};

// Definir ícone personalizado para o Ponto de Acionamento (amarelo)
const locationIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    shadowSize: [41, 41]
});

// Definir ícones personalizados para cada tipo de ponto de apoio
const policeIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    shadowSize: [41, 41]
});

const fireIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    shadowSize: [41, 41]
});

const hospitalIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    shadowSize: [41, 41]
});

const locksmithIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    shadowSize: [41, 41]
});

// Função para calcular a distância entre dois pontos (em metros)
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3; // Raio da Terra em metros
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distância em metros
}

// Função para atualizar o mapa com as coordenadas inseridas
async function updateMap() {
    const coordsInput = document.getElementById('coordinates').value;
    const coords = coordsInput.split(',').map(coord => parseFloat(coord.trim()));

    if (coords.length !== 2 || isNaN(coords[0]) || isNaN(coords[1])) {
        alert("Por favor, insira coordenadas válidas no formato 'Lat, Lng' (ex.: -23.5505, -46.6333)!");
        return;
    }

    const [lat, lng] = coords;

    // Remover marcador anterior, se existir
    if (marker) {
        map.removeLayer(marker);
    }
    // Remover marcadores de pontos de apoio anteriores
    supportMarkers.forEach(m => map.removeLayer(m));
    supportMarkers = [];
    nearestSupportPoints = {}; // Resetar pontos mais próximos

    // Adicionar novo marcador com ícone amarelo e centralizar
    marker = L.marker([lat, lng], { icon: locationIcon })
        .addTo(map)
        .bindPopup("Ponto de Acionamento");
    map.setView([lat, lng], 13);

    // Atualizar lista de pontos de apoio reais
    await fetchSupportPoints(lat, lng);

    // Buscar o endereço via Nominatim
    await fetchAddress(lat, lng);
}

// Função para buscar pontos de apoio reais com Overpass API
async function fetchSupportPoints(lat, lng) {
    const supportTypes = [
        { key: 'hospital', label: 'Hospital', icon: hospitalIcon, fallbackPhone: '+5511999999999', divId: 'hospital-points' },
        { key: 'police', label: 'Polícia', icon: policeIcon, fallbackPhone: '+5511888888888', divId: 'police-points' },
        { key: 'fire_station', label: 'Bombeiros', icon: fireIcon, fallbackPhone: '+551193', divId: 'fire-points' },
        { key: 'locksmith', label: 'Chaveiro', icon: locksmithIcon, fallbackPhone: '+5511777777777', divId: 'locksmith-points' }
    ];

    for (const type of supportTypes) {
        const supportPointsDiv = document.getElementById(type.divId);
        supportPointsDiv.innerHTML = `<h3>${type.label}</h3>`; // Reseta com o título

        const query = `
            [out:json];
            node["${type.key === 'locksmith' ? 'shop' : 'amenity'}"="${type.key}"](around:5000,${lat},${lng});
            out;
        `;
        const url = `https://cors-anywhere.herokuapp.com/http://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

        try {
            const response = await fetch(url);
            const data = await response.json();
            console.log(`Resultados para ${type.label}:`, data.elements); // Log para depuração

            if (!data.elements || data.elements.length === 0) {
                const point = document.createElement('p');
                point.textContent = `Nenhum encontrado nas proximidades`;
                supportPointsDiv.appendChild(point);
            } else {
                let nearestPoint = null;
                let minDistance = Infinity;

                for (const node of data.elements) {
                    const name = node.tags.name || `Sem nome (${type.label})`;
                    const pointLat = node.lat;
                    const pointLng = node.lon;
                    const phone = node.tags.phone || node.tags['contact:phone'] || type.fallbackPhone;
                    const distance = calculateDistance(lat, lng, pointLat, pointLng);

                    // Buscar endereço via Nominatim para este ponto
                    let address = "Endereço não disponível";
                    try {
                        const addressResponse = await fetch(
                            `https://cors-anywhere.herokuapp.com/https://nominatim.openstreetmap.org/reverse?lat=${pointLat}&lon=${pointLng}&format=json&addressdetails=1`,
                            { headers: { 'User-Agent': 'MoviSOS-Dashboard/1.0' } }
                        );
                        const addressData = await addressResponse.json();
                        address = formatAddress(addressData.address);
                    } catch (error) {
                        console.error(`Erro ao buscar endereço para ${name}:`, error.message);
                    }

                    // Criar o conteúdo do popup com nome, endereço e telefone
                    const popupContent = `
                        <b>${type.label}: ${name}</b><br>
                        Endereço: ${address}<br>
                        Telefone: ${phone}
                    `;

                    // Adicionar marcador no mapa com popup personalizado
                    const supportMarker = L.marker([pointLat, pointLng], { icon: type.icon })
                        .addTo(map)
                        .bindPopup(popupContent);
                    supportMarkers.push(supportMarker);

                    // Adicionar na coluna correspondente
                    const point = document.createElement('p');
                    point.textContent = `${name} (${(distance / 1000).toFixed(2)} km)`;
                    supportPointsDiv.appendChild(point);

                    // Verificar se é o mais próximo
                    if (distance < minDistance) {
                        minDistance = distance;
                        nearestPoint = { name, phone, address };
                    }
                }

                // Armazenar o ponto mais próximo para o tipo
                if (nearestPoint) {
                    nearestSupportPoints[type.label] = nearestPoint;
                }
            }
        } catch (error) {
            console.error(`Erro ao buscar ${type.label}:`, error.message); // Log detalhado
            const point = document.createElement('p');
            point.textContent = `Erro ao buscar: ${error.message}`;
            supportPointsDiv.appendChild(point);
        }
    }

    // Garantir que o mapa seja renderizado após adicionar marcadores
    map.invalidateSize();
}

// Função para buscar o endereço via Nominatim
async function fetchAddress(lat, lng) {
    const url = `https://cors-anywhere.herokuapp.com/https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'MoviSOS-Dashboard/1.0' }
        });
        const data = await response.json();
        const formattedAddress = formatAddress(data.address);
        document.getElementById('address').textContent = `Endereço: ${formattedAddress}`;
    } catch (error) {
        document.getElementById('address').textContent = "Endereço: Erro ao buscar endereço";
        console.error("Erro na geocodificação:", error.message);
    }
}

// Função para pesquisar localização e exibir modal
async function searchLocation() {
    const coordsInput = document.getElementById('coordinates').value;
    const coords = coordsInput.split(',').map(coord => parseFloat(coord.trim()));

    if (coords.length !== 2 || isNaN(coords[0]) || isNaN(coords[1])) {
        alert("Por favor, insira coordenadas válidas no formato 'Lat, Lng' (ex.: -23.5505, -46.6333)!");
        return;
    }

    const [lat, lng] = coords;

    // Remover marcador anterior, se existir
    if (marker) {
        map.removeLayer(marker);
    }
    // Remover marcadores de pontos de apoio anteriores
    supportMarkers.forEach(m => map.removeLayer(m));
    supportMarkers = [];
    nearestSupportPoints = {};

    // Adicionar novo marcador com ícone amarelo e centralizar
    marker = L.marker([lat, lng], { icon: locationIcon })
        .addTo(map)
        .bindPopup("Ponto de Acionamento");
    map.setView([lat, lng], 13);

    // Atualizar lista de pontos de apoio reais
    await fetchSupportPoints(lat, lng);

    // Buscar o endereço via Nominatim e exibir no modal
    const url = `https://cors-anywhere.herokuapp.com/https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'MoviSOS-Dashboard/1.0' }
        });
        const data = await response.json();
        const formattedAddress = formatAddress(data.address);
        document.getElementById('modalAddress').textContent = formattedAddress;
        document.getElementById('address').textContent = `Endereço: ${formattedAddress}`;
        document.getElementById('addressModal').style.display = 'flex'; // Exibe o modal
    } catch (error) {
        document.getElementById('modalAddress').textContent = "Erro ao buscar endereço";
        document.getElementById('address').textContent = "Endereço: Erro ao buscar endereço";
        document.getElementById('addressModal').style.display = 'flex';
        console.error("Erro na geocodificação:", error.message);
    }
}

// Função para formatar o endereço retornado pelo Nominatim
function formatAddress(address) {
    const parts = [];
    if (address.road) parts.push(address.road);
    if (address.neighbourhood) parts.push(address.neighbourhood);
    if (address.suburb) parts.push(address.suburb);
    if (address.city) parts.push(address.city);
    if (address.state) parts.push(address.state);
    if (address.postcode) parts.push(address.postcode);
    return parts.join(', ') || "Endereço não detalhado";
}

// Função para fechar o modal
function closeModal() {
    document.getElementById('addressModal').style.display = 'none';
}

// Função para os botões de ação abrir o WhatsApp
function callAction(type) {
    const point = nearestSupportPoints[type];
    if (point && point.phone) {
        const cleanPhone = point.phone.replace(/\D/g, '');
        const whatsappUrl = `https://wa.me/${cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone}`;
        window.open(whatsappUrl, '_blank');
    } else {
        alert(`Nenhum ${type} com número de contato encontrado nas proximidades.`);
    }
}
