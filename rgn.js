/*     Rede Geodésica Nacional

Aluno 1: 57473 Rafael Patronilo
Aluno 2: 58288 João Padrão

Comentario:
Todas as 10 funcionalidades foram implementadas.

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
const HEIGHT_SCALE = 5;

const MARK_RADIUS = 350;

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

// Create html plain text object
function textNode(text){
	return document.createTextNode(text);
}

// Create html bold text object
function bold(text){
	let element = document.createElement("b");
	element.appendChild(textNode(text));
	return element;
}

// Create html break line
function linebreak(){
	return document.createElement("br");
}

// Create html button
function button(id, text, onclick){
	let element = document.createElement("input");
	element.type = "button";
	element.id = id;
	element.value = text;
	element.onclick = onclick;
	return element;
}

// Create fake icon (empty) used in clustering of circles
function fakeIcon(){
	let fakeIcon = L.divIcon({html:"", className:""});
	return fakeIcon;
}

// Create fake marker used as placeholder for POIs without a circle
// Required for proper clustering of circles
function createPlaceholder(pos){
	return L.marker(pos, {icon:fakeIcon()});
}

// Create fake cluster counter used in clustering of circles
function createInvisibleCluster(){
	return L.markerClusterGroup({
		iconCreateFunction: function(cluster) {
			return fakeIcon();
		}
	});
}

function createCircle(pos, radius, color, fillColor, popup){
	let circle =
		L.circle(pos,
			radius,
			{color: color, fillColor: fillColor, fillOpacity: 0.4}
		);
	if( popup != "" )
		circle.bindPopup(popup);
	return circle;
}

function sortObject(object){
	let sorted = {};
	let sortedKeys = Object.keys(object).sort();
	for(let i in sortedKeys){
		sorted[sortedKeys[i]] = object[sortedKeys[i]];
	}
	return sorted;
}

/* Point Of Interest */

class POI {
	constructor(name, latitude, longitude, iconSource){
		this.name = name;
		this.latitude = latitude;
		this.longitude = longitude;
		this.iconSource = iconSource;
		this.marker = null;
	}

	makeMarker(icons){
		this.layer = L.layerGroup();
		this.marker = L.marker(this.getLatLng(), {icon: icons[this.iconSource]}).addTo(this.layer);
		return this.marker;
	}

	isValid(map){
		return true;
	}

	getLatLng(){
		return L.latLng(this.latitude, this.longitude);
	}

}

/* Vertice Geodesico */
class VG extends POI {
	constructor(name, latitude, longitude, altitude, type, order, minDistance, maxDistance) {
		super(name, latitude, longitude, "order" + order);
		this.order = order;
		this.altitude = altitude;
		this.type = type;
		this.minDistance = minDistance;
		this.maxDistance = maxDistance;
	}

	makeMarker(icons){
		super.makeMarker(icons);
		this.marker
			.bindPopup(this.makePopup())
				.bindTooltip(this.makeTooltip());
		return this.marker;
	}

	makeTooltip(){
		return this.name;
	}

	makePopup(){
		let div = document.createElement("div");
		div.appendChild(bold("\u26B2 " + this.name )); 
		div.appendChild(linebreak());

		div.appendChild(textNode("VG de ordem " + this.order));
		div.appendChild(linebreak());

		div.appendChild(textNode("Latitude: "));
		div.appendChild(bold(this.latitude)); 
		div.appendChild(linebreak());

		div.appendChild(textNode("Longitude: "));
		div.appendChild(bold(this.longitude)); 
		div.appendChild(linebreak());

		div.appendChild(textNode("Altitude: "));
		div.appendChild(bold(isNaN(this.altitude) ? "--" : this.altitude)); 
		div.appendChild(linebreak());

		div.appendChild(textNode("Tipo: "));
		div.appendChild(bold(this.type)); 
		div.appendChild(linebreak());

		let name = this.constructor.name;
		div.appendChild(button("", "Mostrar mesma ordem", function(x){
			map.markPOIs(name);
			}));
		
		let lat = this.latitude;
		let lng = this.longitude;
		div.appendChild(button("", "StreetView", function(x){
			window.open("http://maps.google.com/maps?q=&layer=c&cbll="+ lat + "," + lng);
			}));
		return div;
	}

	// Make sure there is a neighbour in range
	isValid(map){
		let pois = map.layerGroups[this.constructor.name].pois;
		if(this.minDistance == null && this.maxDistance == null){
			return true;
		}
		for (let i in pois){
			let latLng = pois[i].getLatLng();
			let dist = haversine(this.latitude, this.longitude, latLng.lat, latLng.lng);
			if((dist >= this.minDistance || this.minDistance == null) && 
				(dist <= this.maxDistance || this.maxDistance == null)){
				return true;
			}
		}
		return false;
	}
}

class VG1 extends VG{
	constructor(name, latitude, longitude, altitude, type){
		super(name, latitude, longitude, altitude, type, 1, 30, 60);
	}

	makePopup(){
		let span = document.createElement("span");
		span.id = "neighbours";
		let popup = super.makePopup();
		popup.appendChild(linebreak());
		popup.appendChild(document.createTextNode("Vizinhos (60km ou menos): "));
		popup.appendChild(span);
		return popup;	
	}

	makeMarker(icons){
		let marker = super.makeMarker(icons);
		let lat = this.latitude;
		let lng = this.longitude;
		// update count each time the popup opens, in case there has been any change
		marker.on('popupopen', function(event){
			let content = event.popup.getContent();
			let span = content.children.namedItem("neighbours")
			span.innerHTML = map.countNeighbours(lat, lng, 60);
		});
		return marker;
	}
}

class VG2 extends VG{
	constructor(name, latitude, longitude, altitude, type){
		super(name, latitude, longitude, altitude, type, 2, 20, 30);
	}
	
	makePopup(){
		let popup = super.makePopup();
		let lat = this.latitude;
		let lng = this.longitude;
		popup.appendChild(button("", "Mostrar vizinhos (30km ou menos)", function(x){
			map.markNeighbours(lat, lng, 30, "VG2");
		}));
		return popup;
	}
}

class VG3 extends VG{
	constructor(name, latitude, longitude, altitude, type){
		super(name, latitude, longitude, altitude, type, 3, 5, 10);
	}
}

class VG4 extends VG{
	constructor(name, latitude, longitude, altitude, type){
		super(name, latitude, longitude, altitude, type, 4, null, null);
	}
}

function xmlToVG(xml) {
	let name = getFirstValueByTagName(xml, "name");
	let latitude = parseFloat(getFirstValueByTagName(xml, "latitude"));
	let longitude = parseFloat(getFirstValueByTagName(xml, "longitude"));
	let order = parseInt(getFirstValueByTagName(xml, "order"));
	let altitude = parseFloat(getFirstValueByTagName(xml, "altitude"));
	let type = getFirstValueByTagName(xml, "type");
	switch(order){
		case 1:
			return new VG1(name, latitude, longitude, altitude, type);
		case 2:
			return new VG2(name, latitude, longitude, altitude, type);
		case 3:
			return new VG3(name, latitude, longitude, altitude, type);
		case 4:
			return new VG4(name, latitude, longitude, altitude, type);
		default:
			return new VG(name, latitude, longitude, altitude, type, order, null, null);
	}
}

/* POI Group */
class Group{
	constructor(){
		this.visible = true;
		this.pois = [];
		this.markers = [];
		this.highest = null;
		this.lowest = null;
	}

	addMarker(icons, poi){
		this.pois.push(poi);
		if(!isNaN(poi.altitude) && (this.highest == null || this.highest.altitude < poi.altitude))
			this.highest = poi;
		if(!isNaN(poi.altitude) && (this.lowest == null || this.lowest.altitude > poi.altitude))
			this.lowest = poi;
		this.markers.push(poi.makeMarker(icons));
	}

	// Adds circles for every POI to the given cluster group
	addCircles(radius, color, fillColor, cluster){
		for(let x in this.pois){
			createCircle(this.pois[x].getLatLng(), radius, color, fillColor, "").addTo(cluster);
		}
	}

	// Adds placeholders (invisible markers) for every POI to the given cluster group
	addPlaceholders(cluster){
		for(let x in this.pois){
			createPlaceholder(this.pois[x].getLatLng()).addTo(cluster);
		}
	}

	countPOIs(){
		return this.pois.length;
	}

	// Counts all POIs that are neighbours (withing a certain distance) of a given point
	countNeighbours(lat, lng, dist){
		let count = 0;
		for(let x in this.pois){
			let poi = this.pois[x];
			let poiPos = poi.getLatLng();
			if(!(poiPos.lat == lat && poiPos.lng == lng) &&
					haversine(lat, lng, poiPos.lat, poiPos.lng) <= dist){
				count++;
			}
		}
		return count;
	}

	// Marks all POIs that are neighbours (withing a certain distance) of a given point
	markNeighbours(pos, dist, cluster){
		for(let x in this.pois){
			let poi = this.pois[x];
			let poiPos = poi.getLatLng();
			if(!poiPos.equals(pos) && 
					haversine(pos.lat, pos.lng, poiPos.lat, poiPos.lng) <= dist){
				createCircle(poiPos, MARK_RADIUS, "orange", "white", "").addTo(cluster);
			}
			else{
				createPlaceholder(poiPos).addTo(cluster);
			}
		}
	}
}

/* MAP */

class Map {
	constructor(center, zoom) {
		this.lmap = L.map(MAP_ID).setView(center, zoom);
		this.addBaseLayers(MAP_LAYERS);
		this.cluster = L.markerClusterGroup().addTo(this.lmap);
		this.circleCluster = createInvisibleCluster().addTo(this.lmap);
		this.layerGroups = {};
		let icons = this.loadIcons(RESOURCES_DIR);
		let pois = this.loadRGN(RESOURCES_DIR + RGN_FILE_NAME);
		this.populate(icons, pois);
		this.addClickHandler(e => {
				this.cleanUpCircles();
				return L.popup()
				.setLatLng(e.latlng)
				.setContent("You clicked the map at " + e.latlng.toString());
			}
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

	cleanUpCircles(){
		this.circleCluster.clearLayers();
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

	// Re-adds the markers to the cluster to update visibility
	remakeCluster(){
		this.cluster.clearLayers();
		for(let x in this.layerGroups)
			if(this.layerGroups[x].visible)
				this.cluster.addLayers(this.layerGroups[x].markers);
	}

	populate(icons, pois)  {
		for(let i = 0 ; i < pois.length ; i++) {
			let poi = pois[i];
			if(this.layerGroups[poi.constructor.name] == undefined){
				this.layerGroups[poi.constructor.name] = new Group();
			}
			this.layerGroups[poi.constructor.name].addMarker(icons, pois[i]);
		}
		this.remakeCluster();
	}

	addClickHandler(handler) {
		let m = this.lmap;
		function handler2(e) {
			return handler(e).openOn(m);
		}
		return this.lmap.on('click', handler2);
	}

	setPOIVisibility(target, visibility){
		this.layerGroups[target].visible = visibility;
		this.remakeCluster();
	}

	centerOn(latitude, longitude){
		this.lmap.flyTo(L.latLng(latitude, longitude), 16);
	}

	calculateVGStats(){
		let returning = {
			countAll : 0,
			countPerOrder: {},
			highest : null,
			lowest : null
		}
		for(let x in this.layerGroups){
			let group = this.layerGroups[x];
			//skip POIs that aren't VGs
			if(!(group.pois.length > 0 && group.pois[0] instanceof VG)){
				continue;
			}
			if(group.visible){
				//update counts
				let count = group.countPOIs();
				returning.countPerOrder[group.pois[0].order] = count;
				returning.countAll += count;

				//find highest VG
				if(returning.highest == null || returning.highest.altitude < group.highest.altitude)
					returning.highest = group.highest;
				//find lowest VG
				if(returning.lowest == null || returning.lowest.altitude > group.lowest.altitude)
					returning.lowest = group.lowest;
			}
			else{
				//consider hidden groups as 0
				returning.countPerOrder[group.pois[0].order] = 0;
			}
		}
		returning.countPerOrder = sortObject(returning.countPerOrder);
		return returning;
	}

	findInvalid(){
		let returning = [];
		for(let g in this.layerGroups){
			if(!this.layerGroups[g].visible) continue;
			let pois = this.layerGroups[g].pois;
			for(let x in pois){
				if(!pois[x].isValid(this)){
					returning.push(pois[x]);
				}
			}
		}
		return returning;
	}

	// Adds placeholders (invisible markers) to the circle cluster 
	//for every poi not in target group
	addPlaceholders(target){
		for(let x in this.layerGroups){
			if(this.layerGroups[x].visible && x !== target){
				this.layerGroups[x].addPlaceholders(this.circleCluster);
			}
		}
	}

	countNeighbours(lat, lng, dist){
		let count = 0;
		for(let x in this.layerGroups)
			count += this.layerGroups[x].countNeighbours(lat, lng, dist);
		return count;
	}

	// Marks all pois on target group
	markPOIs(target) {
		this.cleanUpCircles();
		this.layerGroups[target].addCircles(MARK_RADIUS, "blue", "white", this.circleCluster);
		this.addPlaceholders(target);
	}

	// Marks neighbours of a point in target group
	markNeighbours(lat, lng, dist, target){
		this.cleanUpCircles();
		this.layerGroups[target].markNeighbours(L.latLng(lat, lng), dist, this.circleCluster);
		this.addPlaceholders(target);
	}
}


/* FUNCTIONS for HTML */

function onLoad()
{
	map = new Map(MAP_CENTRE, 12);
	createCircle(MAP_CENTRE, 100, "red", "pink", "FCT/UNL").addTo(map.lmap);
	let inputs = document.getElementsByTagName("input");
	for(let x in inputs){
		if(inputs[x].type === "checkbox")
			checkboxUpdate(inputs[x]);
	}
	displayStatsVG();
}

function checkboxUpdate(checkbox){
	map.cleanUpCircles();
	map.setPOIVisibility(checkbox.id, checkbox.checked);
	displayStatsVG();
}

// Updated the html to reflect the current stats of the VGs
function displayStatsVG() {
	let stats = map.calculateVGStats();
	document.getElementById("visible_caches").innerHTML = stats.countAll.toString();
	let display = "";
	for(let x in stats.countPerOrder){
		//Add a line for each order with the partial count
		display += "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&#8226;&nbsp;Ordem " + 
			x.toString() + ": " + 
			stats.countPerOrder[x].toString() + "<br/>";
	}
	document.getElementById("caches_by_order").innerHTML = display;

	let highestAnchor = document.getElementById("highest_cache");
	let lowestAnchor = document.getElementById("lowest_cache");

	//handle display of highest VG
	if(stats.highest != null) {
		highestAnchor.innerHTML = stats.highest.name;
		//link the VG's name to its location for ease of use
		highestAnchor.href = "javascript:map.centerOn(" + 
			stats.highest.latitude.toString()  + "," + 
			stats.highest.longitude.toString() + ")"; 
	}
	else{
		highestAnchor.innerHTML = "";
		highestAnchor.href = ""; 
	}

	//handle display of lowest VG
	if(stats.lowest != null){
		lowestAnchor.innerHTML = stats.lowest.name;
		//link the VG's name to its location for ease of use
		lowestAnchor.href = "javascript:map.centerOn(" + 
			stats.lowest.latitude.toString()  + "," + 
			stats.lowest.longitude.toString() + ")"; 
	}
	else{
		lowestAnchor.innerHTML = "";
		lowestAnchor.href = ""; 
	}
}

function onFindInvalidClick(){
	// toggle button to hide invalid
	let button = document.getElementById("invalid_caches_button");
	button.value = "Fechar VGs inválidos";
	button.onclick = onHideInvalidClick;
	
	// create scrollbox
	let div = document.getElementById("invalid_caches_div");
	div.style = "height:75px;border:1px solid #A4747E;border-left:0;border-right:0;overflow:auto;";

	let display = "";
	// we search for invalids every time they're requested, in case there has been any changes.
	let invalidArray = map.findInvalid();
	for(let x in invalidArray){
		display += "<a href='javascript:map.centerOn(" + invalidArray[x].latitude + "," +
		invalidArray[x].longitude + ")' >" +
		invalidArray[x].name + "</a><br/>";
	}
	div.innerHTML = display;
}

function onHideInvalidClick(){
	// toggle button to search invalid
	let button = document.getElementById("invalid_caches_button");
	button.value = "Procurar VGs inválidos";
	button.onclick = onFindInvalidClick;
	let div = document.getElementById("invalid_caches_div");
	div.style = "";
	div.innerHTML = "";
}

function onShowHeightsClick(){
	map.cleanUpCircles();
	for(let g in map.layerGroups){
		//skip hidden groups
		if(!map.layerGroups[g].visible)
			continue;
			
		let pois = map.layerGroups[g].pois;
		for(let x in pois){
			let vg = pois[x];
			//skip POIs that aren't VGs
			if(!(vg instanceof VG))
				continue;
				
			let alt = vg.altitude * HEIGHT_SCALE;
			//Some VGs might not have altitude, in which case its value will be NaN
			if(isNaN(alt)){
				createPlaceholder(vg.getLatLng()).addTo(map.circleCluster);
			}
			else {
				createCircle(vg.getLatLng(), alt, "pink", "white", "").addTo(map.circleCluster);
			}
			
		}
	}
}