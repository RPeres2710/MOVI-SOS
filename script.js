// Inicializar o mapa
let map = L.map('map').setView([-23.5505, -46.6333], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

// Marcador para o ponto de acionamento
let marker = null;

// Lista fictícia de pontos de apoio
const supportPoints = [
    { type: "Hospital", name: "Hospital São Luiz", lat: -23.5678, lng: -46.6455, contact: "tel:+5511999999999" },
    { type: "Polícia", name: "5ª Delegacia", lat: -23.5550, lng: -46.6300, contact: "tel:+551188888888" },
    { type: "Bombeiros", name: "Corpo de Bombeiros", lat: -23.5600, lng: -46.6400, contact: "tel:+551193" },
    { type: "Chaveiro", name: "Chaveiro 24h", lat: -23.5480, lng: -46.6350, contact: "tel:+551177777777" }
];

// Adicionar pontos de apoio ao mapa
supportPoints.forEach(point => {
    L.marker([point.lat, point.lng])
        .addTo(map)
        .bindPopup(`${point.type}: ${point.name}`);
});

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

    // Adicionar novo marcador e centralizar
    marker = L.marker([lat, lng]).addTo(map).bindPopup("Ponto de Acionamento");
    map.setView([lat, lng], 13);

    // Atualizar lista de pontos de apoio próximos
    updateSupportPoints(lat, lng);

    // Buscar o endereço via Nominatim
    await fetchAddress(lat, lng);
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

    // Adicionar novo marcador e centralizar
    marker = L.marker([lat, lng]).addTo(map).bindPopup("Ponto de Acionamento");
    map.setView([lat, lng], 13);

    // Atualizar lista de pontos de apoio próximos
    updateSupportPoints(lat, lng);

    // Buscar o endereço via Nominatim e exibir no modal
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
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
        console.error("Erro na geocodificação:", error);
    }
}

// Função para fechar o modal
function closeModal() {
    document.getElementById('addressModal').style.display = 'none';
}

// Função para formatar o endereço
function formatAddress(addressData) {
    const road = addressData.road || "Rua não especificada";
    const houseNumber = addressData.house_number || "S/N";
    const city = addressData.city || addressData.town || addressData.village || "Cidade não especificada";
    const state = addressData.state || "Estado não especificado";
    const postcode = addressData.postcode || "CEP não especificado";
    return `${road}, ${houseNumber}, ${city}, ${state}, ${postcode}`;
}

// Função para buscar o endereço usando Nominatim (usada pelo "Atualizar Mapa")
async function fetchAddress(lat, lng) {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'MoviSOS-Dashboard/1.0' }
        });
        const data = await response.json();
        const formattedAddress = formatAddress(data.address);
        document.getElementById('address').textContent = `Endereço: ${formattedAddress}`;
    } catch (error) {
        document.getElementById('address').textContent = "Endereço: Erro ao buscar endereço";
        console.error("Erro na geocodificação:", error);
    }
}

// Função para calcular distância (fórmula de Haversine simplificada)
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Raio da Terra em km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distância em km
}

// Atualizar lista de pontos de apoio
function updateSupportPoints(lat, lng) {
    const supportDiv = document.getElementById('support-points');
    supportDiv.innerHTML = "<h3>Pontos Próximos:</h3>";
    supportPoints.forEach(point => {
        const distance = calculateDistance(lat, lng, point.lat, point.lng).toFixed(2);
        supportDiv.innerHTML += `<p>${point.type}: ${point.name} - ${distance} km</p>`;
    });
}

// Função para os botões de acionamento/ligação
function callAction(type) {
    const point = supportPoints.find(p => p.type === type);
    if (point) {
        window.location.href = point.contact; // Abre o discador do dispositivo
        alert(`Acionando ${type} em ${point.name}`);
    } else {
        alert(`Nenhum ${type} configurado ainda!`);
    }
}