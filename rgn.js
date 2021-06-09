/*     Rede Geodésica Nacional

Aluno 1: 57473 Rafael Patronilo
Aluno 2: 58288 João Padrão

Comentario:

O ficheiro "rng.js" tem de incluir, logo nas primeiras linhas,
um comentário inicial contendo: o nome e número dos dois alunos que
realizaram o projeto; indicação de quais as partes do trabalho que
foram feitas e das que não foram feitas (para facilitar uma correção
sem enganos); ainda possivelmente alertando para alguns aspetos da
implementação que possam ser menos óbvios para o avaliador.

0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789

HTML DOM documentation: https://www.w3schools.com/js/js_htmldom.asp
Leaflet documentation: https://leafletjs.com/reference-1.7.1.html
*/



/* GLOBAL CONSTANTS */

const MAP_CENTRE =
	[38.661,-9.2044];  // FCT coordinates
const MAP_ID =
	"mapid";
const MAP_ATTRIBUTION =
	'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> '
	+ 'contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>';
const MAP_URL =
	'https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token='
	+ 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw'
const MAP_ERROR =
	"https://upload.wikimedia.org/wikipedia/commons/e/e0/SNice.svg";
const MAP_LAYERS =
	["streets-v11", "outdoors-v11", "light-v10", "dark-v10", "satellite-v9",
		"satellite-streets-v11", "navigation-day-v1", "navigation-night-v1"]
const RESOURCES_DIR =
	"resources/";
const VG_ORDERS =
	["order1", "order2", "order3", "order4"];
const RGN_FILE_NAME =
	"rgn.xml";


/* GLOBAL VARIABLES */

let map = null;



/* USEFUL FUNCTIONS */

// Capitalize the first letter of a string.
function capitalize(str)
{
	return str.length > 0
			? str[0].toUpperCase() + str.slice(1)
			: str;
}

// Distance in km between to pairs of coordinates over the earth's surface.
// https://en.wikipedia.org/wiki/Haversine_formula
function haversine(lat1, lon1, lat2, lon2)
{
    function toRad(deg) { return deg * 3.1415926535898 / 180.0; }
    let dLat = toRad(lat2 - lat1), dLon = toRad (lon2 - lon1);
    let sa = Math.sin(dLat / 2.0), so = Math.sin(dLon / 2.0);
    let a = sa * sa + so * so * Math.cos(toRad(lat1)) * Math.cos(toRad(lat2));
    return 6372.8 * 2.0 * Math.asin (Math.sqrt(a))
}

function loadXMLDoc(filename)
{
	let xhttp = new XMLHttpRequest();
	xhttp.open("GET", filename, false);
	try {
		xhttp.send();
	}
	catch(err) {
		alert("Could not access the local geocaching database via AJAX.\n"
			+ "Therefore, no POIs will be visible.\n");
	}
	return xhttp.responseXML;	
}

function getAllValuesByTagName(xml, name)  {
	return xml.getElementsByTagName(name);
}

function getFirstValueByTagName(xml, name)  {
	return getAllValuesByTagName(xml, name)[0].childNodes[0].nodeValue;
}


/* Point Of Interest */

class POI {
	constructor(name, latitude, longitude, iconSource){
		this.name = name;
		this.latitude = latitude;
		this.longitude = longitude;
		this.iconSource = iconSource;
		this.marker = null;
		this.visible = true;
	}

	makeMarker(icons){
		this.marker = L.marker([this.latitude, this.longitude], {icon: icons[this.iconSource]});
		return this.marker;
	}
}

/* Vertice Geodesico */
class VG extends POI {
	constructor(name, latitude, longitude, altitude, type, order) {
		super(name, latitude, longitude, "order" + order);
		this.order = order;
		this.altitude = altitude;
		this.type = type;
	}

	makeMarker(icons){
		return super.makeMarker(icons)
			.bindPopup("I'm the marker of VG <b>" + this.name + "</b>.<br/>"
			+ "Longitude: <b>" + this.longitude + "</b><br/>"
			+ "Latitude: <b>" + this.latitude + "</b><br/>"
			+ "Altitude: <b>" + this.altitude + "</b><br/>")
				.bindTooltip(this.name);
	}
}

class VG1 extends VG{
	constructor(name, latitude, longitude, altitude, type){
		super(name, latitude, longitude, altitude, type, 1);
	}
}

class VG2 extends VG{
	constructor(name, latitude, longitude, altitude, type){
		super(name, latitude, longitude, altitude, type, 2);
	}
}

class VG3 extends VG{
	constructor(name, latitude, longitude, altitude, type){
		super(name, latitude, longitude, altitude, type, 3);
	}
}

class VG4 extends VG{
	constructor(name, latitude, longitude, altitude, type){
		super(name, latitude, longitude, altitude, type, 4);
	}
}

function xmlToVG(xml) {
	let name = getFirstValueByTagName(xml, "name");
	let latitude = getFirstValueByTagName(xml, "latitude");
	let longitude = getFirstValueByTagName(xml, "longitude");
	let order = getFirstValueByTagName(xml, "order");
	let altitude = getFirstValueByTagName(xml, "altitude");
	let type = getFirstValueByTagName(xml, "type");
	switch(order){
		case "1":
			return new VG1(name, latitude, longitude, altitude, type);
		case "2":
			return new VG2(name, latitude, longitude, altitude, type);
		case "3":
			return new VG3(name, latitude, longitude, altitude, type);
		case "4":
			return new VG4(name, latitude, longitude, altitude, type);
		default:
			return new VG(name, latitude, longitude, altitude, type, order);
	}
}


/* MAP */

class Map {
	constructor(center, zoom) {
		this.lmap = L.map(MAP_ID).setView(center, zoom);
		this.addBaseLayers(MAP_LAYERS);
		let icons = this.loadIcons(RESOURCES_DIR);
		this.pois = this.loadRGN(RESOURCES_DIR + RGN_FILE_NAME);
		this.populate(icons, this.pois);
		this.addClickHandler(e =>
			L.popup()
			.setLatLng(e.latlng)
			.setContent("You clicked the map at " + e.latlng.toString())
		);
	}

	makeMapLayer(name, spec) {
		let urlTemplate = MAP_URL;
		let attr = MAP_ATTRIBUTION;
		let errorTileUrl = MAP_ERROR;
		let layer =
			L.tileLayer(urlTemplate, {
					minZoom: 6,
					maxZoom: 19,
					errorTileUrl: errorTileUrl,
					id: spec,
					tileSize: 512,
					zoomOffset: -1,
					attribution: attr
			});
		return layer;
	}

	addBaseLayers(specs) {
		let baseMaps = [];
		for(let i in specs)
			baseMaps[capitalize(specs[i])] =
				this.makeMapLayer(specs[i], "mapbox/" + specs[i]);
		baseMaps[capitalize(specs[0])].addTo(this.lmap);
		L.control.scale({maxWidth: 150, metric: true, imperial: false})
									.setPosition("topleft").addTo(this.lmap);
		L.control.layers(baseMaps, {}).setPosition("topleft").addTo(this.lmap);
		return baseMaps;
	}

	loadIcons(dir) {
		let icons = [];
		let iconOptions = {
			iconUrl: "??",
			shadowUrl: "??",
			iconSize: [16, 16],
			shadowSize: [16, 16],
			iconAnchor: [8, 8],
			shadowAnchor: [8, 8],
			popupAnchor: [0, -6] // offset the determines where the popup should open
		};
		for(let i = 0 ; i < VG_ORDERS.length ; i++) {
			iconOptions.iconUrl = dir + VG_ORDERS[i] + ".png";
		    icons[VG_ORDERS[i]] = L.icon(iconOptions);
		}
		return icons;
	}

	loadRGN(filename) {
		let xmlDoc = loadXMLDoc(filename);
		let xs = getAllValuesByTagName(xmlDoc, "vg"); 
		let vgs = [];
		if(xs.length == 0)
			alert("Empty file");
		else {
			for(let i = 0 ; i < xs.length ; i++)
				vgs[i] = xmlToVG(xs[i]);
		}
		return vgs;
	}

	populate(icons, pois)  {
		for(let i = 0 ; i < pois.length ; i++)
			this.addMarker(icons, pois[i]);
	}

	addMarker(icons, poi) {
		poi.makeMarker(icons).addTo(this.lmap);
	}

	addClickHandler(handler) {
		let m = this.lmap;
		function handler2(e) {
			return handler(e).openOn(m);
		}
		return this.lmap.on('click', handler2);
	}

	setPOIVisibility(target, visibility){
		for (let i in this.pois){
			if(this.pois[i].constructor.name === target){
				this.pois[i].visible = visibility;
				if(visibility){
					this.pois[i].marker.addTo(this.lmap);
				}
				else{
					this.pois[i].marker.removeFrom(this.lmap);
				}
			}
		}
	}

	addCircle(pos, radius, popup) {
		let circle =
			L.circle(pos,
				radius,
				{color: 'red', fillColor: 'pink', fillOpacity: 0.4}
			);
		circle.addTo(this.lmap);
		if( popup != "" )
			circle.bindPopup(popup);
		return circle;
	}
}


/* FUNCTIONS for HTML */

function onLoad()
{
	map = new Map(MAP_CENTRE, 12);
	map.addCircle(MAP_CENTRE, 100, "FCT/UNL");
	statsVG();
}

function checkboxUpdate(checkbox){
	map.setPOIVisibility(checkbox.id, checkbox.checked);
	statsVG();
}

function statsVG() {
	let countAll = 0;
	let countPerOrder = {};
	for(let i in map.pois){
		let vg = map.pois[i];
		if(vg instanceof VG){
			if(countPerOrder[vg.order] == undefined){
				countPerOrder[vg.order] = 1;
			}
			else{
				countPerOrder[vg.order]++;
			}
		}
		countAll++;
	}
	let display = countAll.toString() + "<br/>";
	for(let x in countPerOrder){
		display += "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&#8226;&nbsp;Order " + x.toString() + ": " + countPerOrder[x].toString() + "<br/>";
	}
	document.getElementById("visible_caches").innerHTML = display;
}