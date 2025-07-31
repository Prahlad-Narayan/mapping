const API_BASE = "https://gmap-0emf.onrender.com";
let map, userPos, directionsService, directionsRenderer;
let tempLatLng = null;
let markers = [];
function addUserMarker(pos) {
  const marker = new google.maps.Marker({
    position: pos,
    map: map,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 8,
      fillColor: "#4285F4",
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: "#fff"
    },
    title: "You are here"
  });
  markers.push(marker);
}

// Initialize Map
async function initMap() {
  const defaultCenter = { lat: 37.7749, lng: -122.4194 };

  map = new google.maps.Map(document.getElementById("map"), {
    center: defaultCenter,
    zoom: 13,
  });

  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer();
  directionsRenderer.setMap(map);

  // Get user location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        map.setCenter(userPos);
        addUserMarker(userPos);
        loadPins();
      },
      loadPins
    );
  } else {
    loadPins();
  }

  // Click on map to add pin
  map.addListener("click", (e) => openAddPinForm(e.latLng.lat(), e.latLng.lng()));

  document.getElementById("close-details").addEventListener("click", () => {
    document.getElementById("pin-details").style.display = "none";
  });

  document.getElementById("cancel-pin").addEventListener("click", () => {
    document.getElementById("form-popup").style.display = "none";
  });

  document.getElementById("save-pin").addEventListener("click", savePin);
}

// Load all pins from DB
async function loadPins() {
  try {
    const lat = userPos ? userPos.lat : 37.77;
    const lng = userPos ? userPos.lng : -122.41;

    const res = await fetch(`${API_BASE}/locations?lat=${lat}&lng=${lng}&max_distance=10000`);
    const pins = await res.json();
    console.log("Fetched pins from DB:", pins);

    clearMarkers();

    if (Array.isArray(pins)) {
      pins.forEach(pin => {
        // ✅ Safely read GeoJSON coordinates
        if (!pin.coordinates || !Array.isArray(pin.coordinates.coordinates)) {
          console.warn("Skipping pin without valid coordinates:", pin);
          return;
        }

        const coords = pin.coordinates.coordinates;
        const lng = parseFloat(coords[0]);
        const lat = parseFloat(coords[1]);

        if (isNaN(lat) || isNaN(lng)) {
          console.warn("Invalid lat/lng, skipping:", pin);
          return;
        }

        const marker = new google.maps.Marker({
          position: { lat: lat, lng: lng },
          map: map,
          title: pin.name || "Donation Box",
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 6,
            fillColor: "#2ecc71", // Green
            fillOpacity: 1,
            strokeWeight: 1,
            strokeColor: "#27ae60"
          }
        });

        marker.addListener("click", () => showPinDetails(pin));
        markers.push(marker);
      });
    } else {
      console.warn("GET /locations did not return an array:", pins);
    }
  } catch (err) {
    console.error("Error loading pins:", err);
  }
}





// Clear all old markers
function clearMarkers() {
  markers.forEach(m => m.setMap(null));
  markers = [];
}

function addMarker(pin) {
  try {
    if (!pin.coordinates || !Array.isArray(pin.coordinates.coordinates)) {
      console.warn("Skipping pin without valid coordinates:", pin);
      return;
    }

    const coords = pin.coordinates.coordinates;
    const lng = parseFloat(coords[0]);
    const lat = parseFloat(coords[1]);

    if (isNaN(lat) || isNaN(lng)) {
      console.warn("Invalid lat/lng, skipping:", pin);
      return;
    }

    const marker = new google.maps.Marker({
      position: { lat: lat, lng: lng },
      map: map,
      title: pin.name || "Donation Box",
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 6,
        fillColor: "#2ecc71",
        fillOpacity: 1,
        strokeWeight: 1,
        strokeColor: "#27ae60"
      }
    });

    marker.addListener("click", () => showPinDetails(pin));
    markers.push(marker);
  } catch (err) {
    console.error("Error creating marker for pin:", pin, err);
  }
}





// Open popup form
function openAddPinForm(lat, lng) {
  tempLatLng = { lat, lng };
  document.getElementById("form-popup").style.display = "flex";
}

// Save pin to backend and reload
async function savePin() {
  const name = document.getElementById("box-name").value.trim();
  const org = document.getElementById("box-org").value.trim();

  if (!name || !org) {
    alert("Enter both Name and Organization");
    return;
  }

const payload = {
  name: name,
  org: org,
  lat: tempLatLng.lat,
  long: tempLatLng.lng
};


  console.log("Sending to backend:", payload);

  try {
    const res = await fetch(`${API_BASE}/locations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const savedPin = await res.json();
    console.log("Backend response:", savedPin);

    if (savedPin.detail) {
      alert("❌ Failed to save pin: " + JSON.stringify(savedPin.detail));
      return;
    }

    alert("✅ Donation Box Saved Successfully!");
    document.getElementById("form-popup").style.display = "none";
    document.getElementById("box-name").value = "";
    document.getElementById("box-org").value = "";

    loadPins(); // ✅ Reload all pins
  } catch (err) {
    console.error("Error saving pin:", err);
    alert("❌ Failed to save pin due to network/backend error");
  }
}


// Add a green dot marker for donation boxes
function addMarker(pin) {
  const marker = new google.maps.Marker({
    position: { lat: pin.lat, lng: pin.long },
    map: map,
    title: pin.name,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 6,
      fillColor: "#2ecc71", // Green dot
      fillOpacity: 1,
      strokeWeight: 1,
      strokeColor: "#27ae60"
    }
  });

  marker.addListener("click", () => showPinDetails(pin));
  markers.push(marker);
}

// Show details + directions
function showPinDetails(pin) {
  document.getElementById("details-name").textContent = pin.name;
  document.getElementById("details-address").textContent = pin.org;
  document.getElementById("pin-details").style.display = "flex";

  if (userPos) {
    getDirections(userPos, { lat: pin.lat, lng: pin.long });
  }
}

function getDirections(start, end) {
  directionsService.route(
    {
      origin: start,
      destination: end,
      travelMode: google.maps.TravelMode.DRIVING
    },
    (result, status) => {
      if (status === "OK") {
        directionsRenderer.setDirections(result);
      } else {
        console.error("Directions failed:", status);
      }
    }
  );
}
