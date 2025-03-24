// Inicializar o mapa com Leaflet
let map = L.map('map').setView([-22.92048625354668, -43.17458379592426], 11);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Função para criar ícones personalizados
function createCustomIcon(color) {
    return L.divIcon({
        className: 'custom-icon',
        html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white;"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
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

// Função para obter o endereço do ponto principal usando Nominatim
async function getMainPointAddress(lat, lng) {
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    try {
        const response = await fetch(nominatimUrl, {
            headers: {
                'User-Agent': 'MOVI SOS Dashboard (seu-email@exemplo.com)'
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
    const radius = 15000; // 15 km
    const overpassUrl = `https://overpass-api.de/api/interpreter`;

    // Construir a consulta Overpass QL com tags alternativas
    const query = `
        [out:json][timeout:60];
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

        // Log detalhado para depuração
        console.log(`Resultados para ${type}:`, data.elements);

        // Processar os resultados
        return data.elements.map(element => {
            const pointLat = element.type === 'node' ? element.lat : element.center.lat;
            const pointLng = element.type === 'node' ? element.lon : element.center.lon;

            return {
                type: type,
                name: element.tags.name || 'Desconhecido',
                lat: pointLat,
                lng: pointLng,
                address: element.tags['addr:full'] || element.tags['addr:street'] || element.tags.address || 'Endereço não disponível',
                phone: element.tags.phone || element.tags.contact || element.tags['contact:phone'] || 'Não disponível',
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

// Função para buscar e exibir a localização
async function searchLocation() {
    const coordsInput = document.getElementById('coords').value.trim();
    
    // Separar as coordenadas
    const coords = coordsInput.split(',').map(coord => parseFloat(coord.trim()));
    
    if (coords.length !== 2 || isNaN(coords[0]) || isNaN(coords[1])) {
        alert('Por favor, insira coordenadas válidas no formato: latitude, longitude (ex.: -22.92048625354668, -43.17458379592426)');
        return;
    }

    const lat = coords[0];
    const lng = coords[1];

    // Limpar o mapa
    map.eachLayer(layer => {
        if (layer instanceof L.Marker) {
            map.removeLayer(layer);
        }
    });

    // Centralizar o mapa na nova localização
    map.setView([lat, lng], 11);

    // Adicionar marcador amarelo para o ponto inserido
    L.marker([lat, lng], { icon: createCustomIcon('yellow') }).addTo(map);

    // Obter e exibir o endereço do ponto principal
    const address = await getMainPointAddress(lat, lng);
    const addressBox = document.getElementById('main-point-address');
    document.getElementById('main-point-address-text').textContent = address;
    addressBox.style.display = 'block';

    // Buscar pontos de apoio próximos usando a Overpass API
    try {
        // Tags expandidas para capturar mais resultados
        const hospitals = await fetchNearbyPlaces(lat, lng, 'hospital', '["amenity"="hospital"]["amenity"!="veterinary"]["healthcare"="hospital"]');
        const police = await fetchNearbyPlaces(lat, lng, 'police', '["amenity"="police"]["building"="police"]["police"]');
        const firefighters = await fetchNearbyPlaces(lat, lng, 'firefighter', '["amenity"="fire_station"]["emergency"="fire_station"]');
        const locksmiths = await fetchNearbyPlaces(lat, lng, 'locksmith', '["shop"="locksmith"]["craft"="locksmith"]');
        const mechanics = await fetchNearbyPlaces(lat, lng, 'mechanic', '["shop"="car_repair"]["amenity"="car_repair"]');

        // Combinar todos os pontos
        const allPoints = [...hospitals, ...police, ...firefighters, ...locksmiths, ...mechanics];

        // Log para verificar todos os pontos encontrados
        console.log('Todos os pontos encontrados:', allPoints);

        // Adicionar marcadores ao mapa com popups estilizados
        allPoints.forEach(point => {
            let color;
            switch (point.type) {
                case 'hospital': color = 'gray'; break;
                case 'police': color = 'blue'; break;
                case 'firefighter': color = 'red'; break;
                case 'locksmith': color = 'green'; break;
                case 'mechanic': color = 'purple'; break;
                default: color = 'black';
            }

            const marker = L.marker([point.lat, point.lng], { icon: createCustomIcon(color) }).addTo(map);
            marker.bindPopup(`
                <b>${point.name}</b><br>
                Endereço: ${point.address}<br>
                Telefone: ${point.phone}
            `);
        });

        // Filtrar e ordenar por distância para cada categoria
        const hospitalPoints = allPoints.filter(p => p.type === 'hospital').sort((a, b) => a.distance - b.distance);
        const policePoints = allPoints.filter(p => p.type === 'police').sort((a, b) => a.distance - b.distance);
        const firefighterPoints = allPoints.filter(p => p.type === 'firefighter').sort((a, b) => a.distance - b.distance);
        const locksmithPoints = allPoints.filter(p => p.type === 'locksmith').sort((a, b) => a.distance - b.distance);
        const mechanicPoints = allPoints.filter(p => p.type === 'mechanic').sort((a, b) => a.distance - b.distance);

        // Atualizar a tabela
        updateTable('hospital-list', hospitalPoints);
        updateTable('police-list', policePoints);
        updateTable('firefighter-list', firefighterPoints);
        updateTable('locksmith-list', locksmithPoints);
        updateTable('mechanic-list', mechanicPoints);

    } catch (error) {
        console.error('Erro ao buscar pontos de apoio:', error);
        alert('Erro ao buscar pontos de apoio. Verifique o console para mais detalhes.');
    }
}

// Função para atualizar a tabela
function updateTable(listId, points) {
    const list = document.getElementById(listId);
    list.innerHTML = '';
    if (points.length === 0) {
        list.innerHTML = '<li>Nenhum encontrado em 15 km</li>';
        return;
    }
    points.forEach(point => {
        if (point.distance <= 15) {
            const li = document.createElement('li');
            li.textContent = `${point.name} (${point.distance.toFixed(2)} km)`;
            list.appendChild(li);
        }
    });
}
