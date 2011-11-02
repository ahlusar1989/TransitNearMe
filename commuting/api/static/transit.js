(function(x) {
	x.Transit = {};
})(this);

// Common library functions.
Transit.addMap = function(type, element, options) {
	switch(type)
	{
		case 'Leaflet': return new Transit._leafletMap(element, options);
		default: throw 'Unknown map type.';
	};
};

Transit.tryGeolocating = function(success, failure) {
	if (navigator && navigator.geolocation) {
		navigator.geolocation.getCurrentPosition(
			function(pos) {
				success && success({
					'lat': pos.coords.latitude,
					'lng': pos.coords.longitude,
				});
			},
			function(error) {
				failure && failure(error);
			}
		);
	}
};

// API calls.
Transit.API = {
	_call: function(urlTmpl) {
		return function(params, callback) {
			var url = urlTmpl, d;
			for (i in params) {
				url = url.replace(RegExp('\\{'+i+'\\}', 'gi'), params[i]);
			}
			d = $.getJSON(url);
			callback && d.success(callback);
		};
	},
};

Transit.API.getNearby = Transit.API._call(
	'/api/stops?lng={lng}&lat={lat}&radius_m={radius_m}');

// Leaflet Map wrapper.
Transit._leafletMap = function(element, options) {
	var map = new L.Map(element),
		latlng = new L.LatLng(options.lat, options.lng),
		url = 'http://otile{s}.mqcdn.com/tiles/1.0.0/osm/{z}/{x}/{y}.png',
		attrib = 'Map data &copy; 2011 OpenStreetMap contributors, tiles courtesy of <a href="http://www.mapquest.com/" target="_blank">MapQuest</a>',
		mqosm = new L.TileLayer(
			url,
			{
				subdomains: '1234',
				maxZoom: 18,
				attribution: attrib,
			}
		);
	map.setView(latlng, 16);
	map.addLayer(mqosm);
	
	this._map = map;
	this._layers = { 'OSM': mqosm };

	if (options.radius) {
		this._layers['radius'] = new L.Circle(latlng, options.radius, { 
			clickable: false,
			weight: 1,
			fillOpacity: 0.1, 
		});
	}
};

Transit._leafletMap.prototype.center = function(latlng) {
	latlng && this._map.setView(latlng, this._map.getZoom());
	this._map.fire('center', { latlng: this._map.getCenter() });
};

Transit._leafletMap.prototype.addCallback = function(options) {
	for (i in options.types) {
		this._map.on(options.types[i], function(e) {
			if (options.apiCall) {
				options.apiCall($.extend(
					{}, 
					options.extraParams, 
					{
						'lng': e.latlng.lng,
						'lat': e.latlng.lat,
					}),
					options.callback
				);
			} else {
				options.callback(e.latlng);
			}
		});
	}
};

Transit._leafletMap.prototype.overlay = function(overlay, overlayID) {
	var oldLayer = this._layers[overlayID],
		geoLayer = new L.GeoJSON();
	
	geoLayer.on('featureparse', function(e) {
		if (e.layer.setIcon && e.properties && e.properties.stop_type) {
			// e.layer.setIcon();
		}
		if (e.properties && e.properties.stop_name) {
			e.layer.bindPopup(e.properties.stop_name);
		}
	});

	geoLayer.addGeoJSON(overlay);

	this._layers[overlayID] = geoLayer;
	this._map.addLayer(geoLayer);
	oldLayer && this._map.removeLayer(oldLayer);
}

Transit._leafletMap.prototype.radius = function(latlng) {
	var radius = this._layers['radius'];	
	if (radius) {
		radius.setLatLng(latlng);
		if (!this._map.hasLayer(radius)) {
			this._map.addLayer(radius);
		}
	}
}