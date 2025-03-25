// Inicializar o mapa com Leaflet
let map = L.map('map').setView([-22.92048625354668, -43.17458379592426], 13);
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

// Função para adicionar atraso entre requisições
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Função para obter o endereço do ponto principal usando Nominatim
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
async function fetchNearbyPlaces(lat, lng, type) {
    const radius = 15000; // em metros
    const overpassUrl = 'https://overpass-api.de/api/interpreter';

    let query;
    switch (type) {
        case 'hospital':
            query = `[out:json];(node(around:${radius},${lat},${lng})["amenity"="hospital"]["amenity"!="veterinary"];way(around:${radius},${lat},${lng})["amenity"="hospital"]["amenity"!="veterinary"];relation(around:${radius},${lat},${lng})["amenity"="hospital"]["amenity"!="veterinary"];);out center 50;`;
            break;
        case 'police':
            query = `[out:json];(node(around:${radius},${lat},${lng})["amenity"="police"];way(around:${radius},${lat},${lng})["amenity"="police"];relation(around:${radius},${lat},${lng})["amenity"="police"];);out center 50;`;
            break;
        case 'firefighter':
            query = `[out:json];(node(around:${radius},${lat},${lng})["amenity"="fire_station"];way(around:${radius},${lat},${lng})["amenity"="fire_station"];relation(around:${radius},${lat},${lng})["amenity"="fire_station"];);out center 50;`;
            break;
        case 'locksmith':
            query = `[out:json];(node(around:${radius},${lat},${lng})["shop"="locksmith"];way(around:${radius},${lat},${lng})["shop"="locksmith"];relation(around:${radius},${lat},${lng})["shop"="locksmith"];);out center 50;`;
            break;
        default:
            throw new Error(`Tipo desconhecido: ${type}`);
    }

    console.log(`Query enviada para ${type}:`, query);

    try {
        const response = await fetch(overpassUrl, {
            method: 'POST',
            body: `data=${encodeURIComponent(query)}`, // Enviar query como parâmetro 'data'
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'MOVI SOS Dashboard (seu-email@exemplo.com)' // Substitua pelo seu email
            }
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Resposta bruta da API para ${type}:`, errorText);
            throw new Error(`Resposta da API não OK: ${response.status} - ${errorText}`);
        }
        const data = await response.json();

        console.log(`Resultados para ${type}: ${data.elements.length} encontrados`, data.elements);

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
        throw error;
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
    ['hospital-list', 'police-list', 'firefighter-list', 'locksmith-list'].forEach(id => {
        document.getElementById(id).innerHTML = '';
    });
    map.setView([-22.92048625354668, -43.17458379592426], 13);
}

// Função para buscar e exibir a localização
async function searchLocation() {
    const coordsInput = document.getElementById('coords').value.trim();
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

    // Obter e exibir o endereço do ponto principal
    const address = await getMainPointAddress(lat, lng);
    const addressBox = document.getElementById('main-point-address');
    document.getElementById('main-point-address-text').textContent = address;
    addressBox.style.display = 'block';

    // Buscar pontos de apoio sequencialmente com atraso
    try {
        const allPoints = [];

        const hospitals = await fetchNearbyPlaces(lat, lng, 'hospital');
        allPoints.push(...hospitals);
        updateTable('hospital-list', hospitals.filter(p => p.distance <= 15).sort((a, b) => a.distance - b.distance));
        await delay(1000);

        const police = await fetchNearbyPlaces(lat, lng, 'police');
        allPoints.push(...police);
        updateTable('police-list', police.filter(p => p.distance <= 15).sort((a, b) => a.distance - b.distance));
        await delay(1000);

        const firefighters = await fetchNearbyPlaces(lat, lng, 'firefighter');
        allPoints.push(...firefighters);
        updateTable('firefighter-list', firefighters.filter(p => p.distance <= 15).sort((a, b) => a.distance - b.distance));
        await delay(1000);

        const locksmiths = await fetchNearbyPlaces(lat, lng, 'locksmith');
        allPoints.push(...locksmiths);
        updateTable('locksmith-list', locksmiths.filter(p => p.distance <= 15).sort((a, b) => a.distance - b.distance));

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

    } catch (error) {
        console.error('Erro detalhado ao buscar pontos de apoio:', error);
        alert(`Erro ao buscar pontos de apoio: ${error.message}. Verifique o console para mais detalhes.`);
    }
}

// Função para atualizar a tabela
function updateTable(listId, points) {
    const list = document.getElementById(listId);
    if (!list) {
        console.error(`Elemento com ID ${listId} não encontrado no DOM`);
        return;
    }
    list.innerHTML = '';
    if (points.length === 0) {
        list.innerHTML = '<li>Nenhum encontrado em 15 km</li>';
        return;
    }
    points.forEach(point => {
        const li = document.createElement('li');
        li.textContent = `${point.name} (${point.distance.toFixed(2)} km)`;
        list.appendChild(li);
    });
}
