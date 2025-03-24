// Inicializar o mapa com Leaflet
let map = L.map('map').setView([-22.92048625354668, -43.17458379592426], 13); // Coordenadas iniciais e zoom
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

// Função para buscar lugares próximos usando a Overpass API
async function fetchNearbyPlaces(lat, lng, type, tag) {
    // Definir o raio de busca (1 km)
    const radius = 1000; // em metros
    const overpassUrl = `https://overpass-api.de/api/interpreter`;

    // Construir a consulta Overpass QL
    const query = `
        [out:json];
        node(around:${radius},${lat},${lng})[${tag}];
        out body;
    `;

    try {
        const response = await fetch(overpassUrl, {
            method: 'POST',
            body: query
        });
        const data = await response.json();

        // Processar os resultados
        return data.elements.map(element => ({
            type: type,
            name: element.tags.name || 'Desconhecido',
            lat: element.lat,
            lng: element.lon,
            address: element.tags.address || 'Endereço não disponível',
            phone: element.tags.phone || 'Não disponível',
            distance: calculateDistance(lat, lng, element.lat, element.lon)
        }));
    } catch (error) {
        console.error(`Erro ao buscar ${type}:`, error);
        return [];
    }
}

// Função para buscar e exibir a localização
async function searchLocation() {
    const coordsInput = document.getElementById('coords').value.trim();
    
    // Separar as coordenadas (esperado: "latitude, longitude")
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
    map.setView([lat, lng], 13);

    // Adicionar marcador amarelo para o ponto inserido
    L.marker([lat, lng], { icon: createCustomIcon('yellow') }).addTo(map);

    // Buscar pontos de apoio próximos usando a Overpass API
    try {
        const hospitals = await fetchNearbyPlaces(lat, lng, 'hospital', 'amenity=hospital');
        const police = await fetchNearbyPlaces(lat, lng, 'police', 'amenity=police');
        const firefighters = await fetchNearbyPlaces(lat, lng, 'firefighter', 'amenity=fire_station');
        const locksmiths = await fetchNearbyPlaces(lat, lng, 'locksmith', 'shop=locksmith');

        // Combinar todos os pontos
        const allPoints = [...hospitals, ...police, ...firefighters, ...locksmiths];

        // Adicionar marcadores ao mapa
        allPoints.forEach(point => {
            let color;
            switch (point.type) {
                case 'hospital': color = 'gray'; break;
                case 'police': color = 'blue'; break;
                case 'firefighter': color = 'red'; break;
                case 'locksmith': color = 'green'; break;
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

        // Atualizar a tabela
        updateTable('hospital-list', hospitalPoints);
        updateTable('police-list', policePoints);
        updateTable('firefighter-list', firefighterPoints);
        updateTable('locksmith-list', locksmithPoints);

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
        list.innerHTML = '<li>Nenhum encontrado em 1 km</li>';
        return;
    }
    points.forEach(point => {
        if (point.distance <= 1) { // Mostrar apenas pontos dentro de 1 km
            const li = document.createElement('li');
            li.textContent = `${point.name} (${point.distance.toFixed(2)} km)`;
            list.appendChild(li);
        }
    });
}
