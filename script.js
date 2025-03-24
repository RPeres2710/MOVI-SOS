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
async function fetchNearbyPlaces(lat, lng, type, query) {
    const radius = 10000; // Fixado em 10 km
    const overpassUrl = `https://overpass-api.de/api/interpreter`;

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

// Função para limpar o formulário, o mapa e as listas
function resetForm() {
    // Limpar o campo de entrada
    document.getElementById('coords').value = '';

    // Limpar o mapa (remover todos os marcadores, mas manter a camada de tiles)
    map.eachLayer(layer => {
        if (layer instanceof L.Marker) {
            map.removeLayer(layer);
        }
    });

    // Esconder a caixa de endereço do ponto principal
    document.getElementById('main-point-address').style.display = 'none';
    document.getElementById('main-point-address-text').textContent = '';

    // Limpar as listas de pontos de apoio
    const lists = ['hospital-list', 'police-list', 'firefighter-list', 'locksmith-list', 'mechanic-list'];
    lists.forEach(listId => {
        const list = document.getElementById(listId);
        list.innerHTML = '';
    });

    // Centralizar o mapa na posição inicial
    map.setView([-22.92048625354668, -43.17458379592426], 11);
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
        // Consulta para Hospitais
        const hospitalQuery = `
            [out:json][timeout:60];
            (
                node(around:10000,${lat},${lng})["amenity"="hospital"]["amenity"!="veterinary"];
                way(around:10000,${lat},${lng})["amenity"="hospital"]["amenity"!="veterinary"];
                relation(around:10000,${lat},${lng})["amenity"="hospital"]["amenity"!="veterinary"];
                node(around:10000,${lat},${lng})["healthcare"="hospital"];
                way(around:10000,${lat},${lng})["healthcare"="hospital"];
                relation(around:10000,${lat},${lng})["healthcare"="hospital"];
                node(around:10000,${lat},${lng})["amenity"="hospital"]["name"~"Hospital|Clínica"];
                way(around:10000,${lat},${lng})["amenity"="hospital"]["name"~"Hospital|Clínica"];
                relation(around:10000,${lat},${lng})["amenity"="hospital"]["name"~"Hospital|Clínica"];
            );
            out center;
        `;
        const hospitals = await fetchNearbyPlaces(lat, lng, 'hospital', hospitalQuery);

        // Consulta para Polícia (BPM, DP, DEAT, etc.)
        const policeQuery = `
            [out:json][timeout:60];
            (
                node(around:10000,${lat},${lng})["amenity"="police"];
                way(around:10000,${lat},${lng})["amenity"="police"];
                relation(around:10000,${lat},${lng})["amenity"="police"];
                node(around:10000,${lat},${lng})["amenity"="police_station"];
                way(around:10000,${lat},${lng})["amenity"="police_station"];
                relation(around:10000,${lat},${lng})["amenity"="police_station"];
                node(around:10000,${lat},${lng})["building"="police"];
                way(around:10000,${lat},${lng})["building"="police"];
                relation(around:10000,${lat},${lng})["building"="police"];
                node(around:10000,${lat},${lng})["office"="police"];
                way(around:10000,${lat},${lng})["office"="police"];
                relation(around:10000,${lat},${lng})["office"="police"];
                node(around:10000,${lat},${lng})["amenity"="police"]["name"~"BPM|DP|DEAT|Delegacia|Batalhão|Polícia Militar|Polícia Civil|Polícia Federal"];
                way(around:10000,${lat},${lng})["amenity"="police"]["name"~"BPM|DP|DEAT|Delegacia|Batalhão|Polícia Militar|Polícia Civil|Polícia Federal"];
                relation(around:10000,${lat},${lng})["amenity"="police"]["name"~"BPM|DP|DEAT|Delegacia|Batalhão|Polícia Militar|Polícia Civil|Polícia Federal"];
                node(around:10000,${lat},${lng})["destination"~"BPM|DP|DEAT|Delegacia|Batalhão|Polícia"];
                way(around:10000,${lat},${lng})["destination"~"BPM|DP|DEAT|Delegacia|Batalhão|Polícia"];
                relation(around:10000,${lat},${lng})["destination"~"BPM|DP|DEAT|Delegacia|Batalhão|Polícia"];
            );
            out center;
        `;
        const police = await fetchNearbyPlaces(lat, lng, 'police', policeQuery);

        // Consulta para Bombeiros
        const firefighterQuery = `
            [out:json][timeout:60];
            (
                node(around:10000,${lat},${lng})["amenity"="fire_station"];
                way(around:10000,${lat},${lng})["amenity"="fire_station"];
                relation(around:10000,${lat},${lng})["amenity"="fire_station"];
                node(around:10000,${lat},${lng})["emergency"="fire_station"];
                way(around:10000,${lat},${lng})["emergency"="fire_station"];
                relation(around:10000,${lat},${lng})["emergency"="fire_station"];
                node(around:10000,${lat},${lng})["emergency"="fire_department"];
                way(around:10000,${lat},${lng})["emergency"="fire_department"];
                relation(around:10000,${lat},${lng})["emergency"="fire_department"];
                node(around:10000,${lat},${lng})["building"="fire_station"];
                way(around:10000,${lat},${lng})["building"="fire_station"];
                relation(around:10000,${lat},${lng})["building"="fire_station"];
                node(around:10000,${lat},${lng})["amenity"="fire_station"]["name"~"Corpo de Bombeiros|Bombeiros|Quartel"];
                way(around:10000,${lat},${lng})["amenity"="fire_station"]["name"~"Corpo de Bombeiros|Bombeiros|Quartel"];
                relation(around:10000,${lat},${lng})["amenity"="fire_station"]["name"~"Corpo de Bombeiros|Bombeiros|Quartel"];
            );
            out center;
        `;
        const firefighters = await fetchNearbyPlaces(lat, lng, 'firefighter', firefighterQuery);

        // Consulta para Chaveiros
        const locksmithQuery = `
            [out:json][timeout:60];
            (
                node(around:10000,${lat},${lng})["shop"="locksmith"];
                way(around:10000,${lat},${lng})["shop"="locksmith"];
                relation(around:10000,${lat},${lng})["shop"="locksmith"];
                node(around:10000,${lat},${lng})["craft"="locksmith"];
                way(around:10000,${lat},${lng})["craft"="locksmith"];
                relation(around:10000,${lat},${lng})["craft"="locksmith"];
                node(around:10000,${lat},${lng})["service"="locksmith"];
                way(around:10000,${lat},${lng})["service"="locksmith"];
                relation(around:10000,${lat},${lng})["service"="locksmith"];
                node(around:10000,${lat},${lng})["shop"="locksmith"]["name"~"Chaveiro"];
                way(around:10000,${lat},${lng})["shop"="locksmith"]["name"~"Chaveiro"];
                relation(around:10000,${lat},${lng})["shop"="locksmith"]["name"~"Chaveiro"];
            );
            out center;
        `;
        const locksmiths = await fetchNearbyPlaces(lat, lng, 'locksmith', locksmithQuery);

        // Consulta para Mecânicos
        const mechanicQuery = `
            [out:json][timeout:60];
            (
                node(around:10000,${lat},${lng})["shop"="car_repair"];
                way(around:10000,${lat},${lng})["shop"="car_repair"];
                relation(around:10000,${lat},${lng})["shop"="car_repair"];
                node(around:10000,${lat},${lng})["amenity"="car_repair"];
                way(around:10000,${lat},${lng})["amenity"="car_repair"];
                relation(around:10000,${lat},${lng})["amenity"="car_repair"];
                node(around:10000,${lat},${lng})["amenity"="car_workshop"];
                way(around:10000,${lat},${lng})["amenity"="car_workshop"];
                relation(around:10000,${lat},${lng})["amenity"="car_workshop"];
                node(around:10000,${lat},${lng})["craft"="car_repair"];
                way(around:10000,${lat},${lng})["craft"="car_repair"];
                relation(around:10000,${lat},${lng})["craft"="car_repair"];
                node(around:10000,${lat},${lng})["shop"="car_repair"]["name"~"Oficina|Auto|Mecânica"];
                way(around:10000,${lat},${lng})["shop"="car_repair"]["name"~"Oficina|Auto|Mecânica"];
                relation(around:10000,${lat},${lng})["shop"="car_repair"]["name"~"Oficina|Auto|Mecânica"];
            );
            out center;
        `;
        const mechanics = await fetchNearbyPlaces(lat, lng, 'mechanic', mechanicQuery);

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
        list.innerHTML = '<li>Nenhum encontrado em 10 km</li>';
        return;
    }
    points.forEach(point => {
        if (point.distance <= 10) {
            const li = document.createElement('li');
            li.textContent = `${point.name} (${point.distance.toFixed(2)} km)`;
            list.appendChild(li);
        }
    });
}
