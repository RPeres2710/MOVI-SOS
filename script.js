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

// Função para adicionar um atraso (em milissegundos)
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
    map.setView([lat, lng], 15); // Aumentei o zoom para melhor visualização em 1 km

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

    // Dados mockados como fallback
    const mockData = {
        hospital: [{ lat: lat + 0.005, lon: lng + 0.005, tags: { name: "Hospital Mock", phone: "+5511999999999" } }],
        police: [{ lat: lat + 0.006, lon: lng + 0.006, tags: { name: "Polícia Mock", phone: "+5511888888888" } }],
        fire_station: [{ lat: lat + 0.007, lon: lng + 0.007, tags: { name: "Bombeiros Mock", phone: "+551193" } }],
        locksmith: [{ lat: lat + 0.008, lon: lng + 0.008, tags: { name: "Chaveiro Mock", phone: "+5511777777777" } }]
    };

    for (const type of supportTypes) {
        const supportPointsDiv = document.getElementById(type.divId);
        supportPointsDiv.innerHTML = `<h3>${type.label}</h3>`; // Reseta com o título

        const query = `
            [out:json];
            node["${type.key === 'locksmith' ? 'shop' : 'amenity'}"="${type.key}"](around:1000,${lat},${lng});
            out body;
        `;
        const url = `https://cors-anywhere.herokuapp.com/http://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

        try {
            // Adicionar atraso para evitar bloqueio do CORS Anywhere
            await delay(2000); // 2 segundos de atraso entre requisições

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status} - ${response.statusText}`);
            }
            const data = await response.json();
            console.log(`Dados recebidos para ${type.label}:`, data); // Log detalhado

            let elements = data.elements;

            // Se não houver dados, usar mock como fallback
            if (!elements || elements.length === 0) {
                console.warn(`Nenhum dado real encontrado para ${type.label}. Usando dados mockados.`);
                elements = mockData[type.key];
            }

            if (!elements || elements.length === 0) {
                const point = document.createElement('p');
                point.textContent = `Nenhum ${type.label} encontrado em 1 km`;
                supportPointsDiv.appendChild(point);
            } else {
                let nearestPoint = null;
                let minDistance = Infinity;

                // Filtrar apenas pontos dentro de 1 km e encontrar o mais próximo
                for (const node of elements) {
                    const pointLat = node.lat;
                    const pointLng = node.lon;
                    const distance = calculateDistance(lat, lng, pointLat, pointLng);

                    // Ignorar pontos fora do raio de 1 km
                    if (distance > 1000) continue;

                    const name = node.tags && node.tags.name ? node.tags.name : `Sem nome (${type.label})`;
                    const phone = node.tags && (node.tags.phone || node.tags['contact:phone']) || type.fallbackPhone;

                    // Buscar endereço via Nominatim para este ponto
                    let address = "Endereço não disponível";
                    try {
                        const addressResponse = await fetch(
                            `https://cors-anywhere.herokuapp.com/https://nominatim.openstreetmap.org/reverse?lat=${pointLat}&lon=${pointLng}&format=json&addressdetails=1`,
                            { headers: { 'User-Agent': 'MoviSOS-Dashboard/1.0' } }
                        );
                        if (!addressResponse.ok) throw new Error(`Erro HTTP: ${addressResponse.status}`);
                        const addressData = await addressResponse.json();
                        address = formatAddress(addressData.address);
                    } catch (error) {
                        console.error(`Erro ao buscar endereço para ${name}:`, error.message);
                        address = `Erro ao buscar endereço: ${error.message}`;
                    }

                    // Verificar se é o mais próximo
                    if (distance < minDistance) {
                        minDistance = distance;
                        nearestPoint = { name, phone, address, lat: pointLat, lng: pointLng };
                    }
                }

                // Se encontrou um ponto dentro de 1 km, exibir
                if (nearestPoint) {
                    const popupContent = `
                        <b>${type.label}: ${nearestPoint.name}</b><br>
                        Endereço: ${nearestPoint.address}<br>
                        Telefone: ${nearestPoint.phone}
                    `;

                    const supportMarker = L.marker([nearestPoint.lat, nearestPoint.lng], { icon: type.icon })
                        .addTo(map)
                        .bindPopup(popupContent);
                    supportMarkers.push(supportMarker);

                    const point = document.createElement('p');
                    point.textContent = `${nearestPoint.name} (${(minDistance / 1000).toFixed(2)} km)${elements === mockData[type.key] ? ' [Mock]' : ''}`;
                    supportPointsDiv.appendChild(point);

                    nearestSupportPoints[type.label] = nearestPoint;
                } else {
                    const point = document.createElement('p');
                    point.textContent = `Nenhum ${type.label} encontrado em 1 km`;
                    supportPointsDiv.appendChild(point);
                }
            }
        } catch (error) {
            console.error(`Erro ao buscar ${type.label}:`, error.message); // Log detalhado
            const point = document.createElement('p');
            point.textContent = `Erro ao buscar ${type.label}: ${error.message}`;
            supportPointsDiv.appendChild(point);

            // Usar dados mockados como fallback
            console.warn(`Usando dados mockados para ${type.label} devido ao erro.`);
            const mockElements = mockData[type.key];
            let nearestPoint = null;
            let minDistance = Infinity;

            for (const node of mockElements) {
                const pointLat = node.lat;
                const pointLng = node.lon;
                const distance = calculateDistance(lat, lng, pointLat, pointLng);

                // Ignorar pontos fora do raio de 1 km
                if (distance > 1000) continue;

                const name = node.tags.name;
                const phone = node.tags.phone;

                if (distance < minDistance) {
                    minDistance = distance;
                    nearestPoint = { name, phone, address: "Endereço mockado", lat: pointLat, lng: pointLng };
                }
            }

            if (nearestPoint) {
                const popupContent = `
                    <b>${type.label}: ${nearestPoint.name}</b><br>
                    Endereço: ${nearestPoint.address}<br>
                    Telefone: ${nearestPoint.phone}
                `;

                const supportMarker = L.marker([nearestPoint.lat, nearestPoint.lng], { icon: type.icon })
                    .addTo(map)
                    .bindPopup(popupContent);
                supportMarkers.push(supportMarker);

                const point = document.createElement('p');
                point.textContent = `${nearestPoint.name} (${(minDistance / 1000).toFixed(2)} km) [Mock]`;
                supportPointsDiv.appendChild(point);

                nearestSupportPoints[type.label] = nearestPoint;
            } else {
                const point = document.createElement('p');
                point.textContent = `Nenhum ${type.label} encontrado em 1 km [Mock]`;
                supportPointsDiv.appendChild(point);
            }
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
        if (!response.ok) throw new Error(`Erro HTTP: ${response.status} - ${response.statusText}`);
        const data = await response.json();
        const formattedAddress = formatAddress(data.address);
        document.getElementById('address').textContent = `Endereço: ${formattedAddress}`;
    } catch (error) {
        console.error("Erro na geocodificação:", error.message);
        document.getElementById('address').textContent = `Endereço: Erro ao buscar - ${error.message}`;
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
    map.setView([lat, lng], 15); // Aumentei o zoom para melhor visualização em 1 km

    // Atualizar lista de pontos de apoio reais
    await fetchSupportPoints(lat, lng);

    // Buscar o endereço via Nominatim e exibir no modal
    const url = `https://cors-anywhere.herokuapp.com/https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'MoviSOS-Dashboard/1.0' }
        });
        if (!response.ok) throw new Error(`Erro HTTP: ${response.status} - ${response.statusText}`);
        const data = await response.json();
        const formattedAddress = formatAddress(data.address);
        document.getElementById('modalAddress').textContent = formattedAddress;
        document.getElementById('address').textContent = `Endereço: ${formattedAddress}`;
        document.getElementById('addressModal').style.display = 'flex'; // Exibe o modal
    } catch (error) {
        console.error("Erro na geocodificação:", error.message);
        document.getElementById('modalAddress').textContent = `Erro ao buscar endereço: ${error.message}`;
        document.getElementById('address').textContent = `Endereço: Erro ao buscar - ${error.message}`;
        document.getElementById('addressModal').style.display = 'flex';
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
