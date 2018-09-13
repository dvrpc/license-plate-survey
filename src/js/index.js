import { ckmeans } from '../../node_modules/simple-statistics'
import '../css/index.css'
import Logo from '../img/DVRPCLogo.png'
import Loading from '../img/cat.gif'
mapboxgl.accessToken = 'pk.eyJ1IjoiYmVhdHR5cmUxIiwiYSI6ImNqOGFpY3o0cTAzcXoycXE4ZTg3d3g5ZGUifQ.VHOvVoTgZ5cRko0NanhtwA'
// color schemes for each operator
const schemes = {
    'SEPTA': {
        'Rapid Transit': ["#fbd8f6", '#dda5d6', '#be72b6', '#9e3e97'],
        'Commuter Rail': ["#c1e7ff", '#86b0cc', '#4c7c9b', '#004c6d'],
        'Surface Trolley': ['#d1eac7', '#a7cd99', '#7db06d', '#529442'],
        'Subway': ['#ffdbc2', '#ffbe8e', '#fca05a', '#f58221'],
        'Subway/Elevated': ['#cae5ff', '#97c1ea', '#619fd6', '#067dc1'],
    },
    'DRPA': {
        'Rapid Transit': ['#ffd6d5', '#ffa3a4', '#fa6c76', '#ed164b']
    },
    'Amtrak': {
        'Intercity Passenger Rail': ['#e2e2e2', '#a4b1c0', '#65829e', '#1b567d']
    },
    'NJ Transit': {
        'Commuter Rail': ['#e2e2e2', '#f18541', '#b02c87', '#045099'],
        'Light Rail': ['#ffd847', '#9de779', '#2ae6c2', '#00daf5']
    },
    'DOT': {
        'Park and Ride': ['#999999', '#777777', '#575757', '#383838']
    },
}
const logoContainer = document.querySelector('#dvrpc-logo')
let logo = new Image()
logo.src = Logo
logoContainer.appendChild(logo)

const loadingContainer = document.querySelector('#cat-loading')
let loading = new Image()
loading.src = Loading
loadingContainer.appendChild(loading)
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/beattyre1/cjhw5mutc17922sl7me19mwc8',
    attributionControl: true,
    center: [-75.2273, 40.071],
    zoom: 12 // or whatever zoom you want
});

map.fitBounds([[-76.0941, 39.4921], [-74.3253, 40.6147]]);

// try to work around arcgis 404 error
fetch('https://services1.arcgis.com/LWtWv6q6BJyKidj8/ArcGIS/rest/services/HexBins_StationShed/FeatureServer/0/query?where=1%3D1&outFields=OBJECTID%2C+GRID_ID&outSR=4326&geometryPrecision=4&f=pgeojson')
    .then(response => {
        if (response.ok) {
            response.json()
                .then(features => {
                    map.addSource('hexBins', {
                        type: 'geojson',
                        data: features
                    })
                })
        }
    }).catch(err => console.err('Error occured in ArcGIS fetch'))

/* HexStyling(id, quartiles, infoArray) -- mmolta, rbeatty
    @DESC: Styling function for aggregate geometries that will classified into quartiles based on input range
    @params:
        @id: 
            - DATA TYPE: string
            - DESC: Identifier that will be assigned to the map layer
        @quartiles: 
            - DATA TYPE: object
            - DESC: Object that contains the classification break points that is outputted by the Quartiles function (def: L26)
        @infoArray: 
            - DATA TYPE: object
            - DESC: Object that contains operator and line type information to be used to assign the appropriate color scheme
    @usage:
        - L212
*/
const HexStyling = (infoArray, colorScheme, filter) => {
    console.log({ infoArray })
    console.log({ colorScheme })
    console.log({ filter })
    // sort object by counts
    const SortObjectsByField = field => {
        let sortOrder = 1
        return (a, b) => {
            let result = (a[field] < b[field]) ? -1 : (a[field] > b[field]) ? 1 : 0;
            return result * sortOrder
        }
    }
    const BuildLegend = (content, colorScheme) => {
        let range = []
        for (let i in content.data) {
            range.push(content.data[i].count)
        }
        // create classification
        let temp = range.length > 4 ? ckmeans(range, 4) : ckmeans(range, range.length) //ckmeans, simple-statistics library
        temp.forEach(cluster => {
            let temp = { 'break': [cluster[0], cluster[cluster.length - 1]], 'count': cluster.length, 'features': [] }
            // push GRID_IDs into arrays corresponding to correct classification
            for (let i in content.data) {
                content.data[i].count >= temp.break[0] && content.data[i].count <= temp.break[1] ? temp.features.push(content.data[i].id) : undefined
            }
            content.breaks.push(temp)
        })
        const legendBody = document.querySelector(".legend__body")

        // numerical summaries
        legendBody.innerHTML = `
        <div class="legend__station-summary">
            <h1 class="legend__emphasis">${content.name}</h1>
            <p class="legend__text"><span class="legend__emphasis">${content.operator}</span> operated <span class="legend__emphasis">${content.mode}</span> station.</p>
        </div>
        <div class="legend__number-summary">
            <div class="legend__summary-container">
                <p class="legend__emphasis summary">${range.reduce((a, b) => a + b)}</p>
                <p class="legend__text">Total Commuters</p>
            </div>
            <div class="legend__summary-container">
                <p class="legend__emphasis summary">${Math.floor((Math.random() * 100))}</p>
                <p class="legend__text">Average Miles Traveled</p>
            </div>
        </div>
        <div class="legend__distribution-summary"></div>
        `
        // set colors appropriately based on operator/mode scheme system
        const emphasis = document.querySelectorAll(".legend__emphasis")
        emphasis.forEach(node => {
            node.style.color = colorScheme[content.operator][content.mode][2]
        })

        // create legend boxes
        let i = 0
        colorScheme[content.operator][content.mode].forEach(classification => {
            const container = document.querySelector(".legend__distribution-summary")
            let legendItem = document.createElement("div")
            let height = document.querySelector('body').clientHeight * 0.045
            if (i < 2) {
                legendItem.style.cssText = `width: ${height}px; height: ${height}px; background-color: ${classification}; font-weight: 700`
            }
            else {
                legendItem.style.cssText = `width: ${height}px; height: ${height}px; background-color: ${classification}; color: white; font-weight: 700`
            }
            legendItem.innerHTML = `<p>${content.breaks[i]['break'][1]}</p>`
            container.appendChild(legendItem)
            i++
        })
    }
    const GenerateFillFunction = (infoArray, colorScheme) => {
        let stops = []
        Object.keys(infoArray.breaks).forEach(key => {
            infoArray.breaks[key].features.forEach(feature => {
                stops.push([feature, colorScheme[infoArray.operator][infoArray.mode][key]])
            })
        })
        return stops
    }


    infoArray['data'].sort(SortObjectsByField('count'))
    BuildLegend(infoArray, schemes)
    if (infoArray.operator.length != 1) {

        return {
            'id': 'hexBins',
            'type': 'fill',
            'source': 'hexBins',
            'filter': ['match', ['get', 'GRID_ID'], filter, true, false],
            'paint': {
                'fill-color': {
                    property: 'GRID_ID',
                    type: 'categorical',
                    default: '#ccc',
                    stops: GenerateFillFunction(infoArray, colorScheme)
                },
                'fill-outline-color': '#888'
            }
        }
    }
    else {
        return {
            'id': 'hexBins',
            'type': 'fill',
            'source': 'hexBins',
            'filter': ['match', ['get', 'GRID_ID'], filter, true, false],
            'paint': {
                'fill-color': {
                    property: 'GRID_ID',
                    type: 'categorical',
                    default: '#ccc',
                    stops: GenerateFillFunction(infoArray, colorScheme)
                },
                'fill-outline-color': '#666'
            }
        }
    }
}

// function to get station sheds hexagons on submit
const form = document.querySelector('#main-form')
let data = undefined
// populate dropdowns with possible query values
// @NOTE: only works locally, on rbeatty's machine. He holds the keys to the castle.
fetch('https://a.michaelruane.com/api/test')
    .then(response => {
        if (response.ok) {
            response.json()
                .then(jawn => {
                    // listener to populate year dropdown with valid values based on db on station change
                    form[0].addEventListener('change', e => {
                        // remove any artifacts
                        while (form[1].firstChild) {
                            form[1].removeChild(form[1].firstChild)
                        }
                        // get the new station value
                        let station = e.target.value

                        // loop through response, grab the years that are associated with the new station value and create an appropriate amount of dropdown options
                        jawn.forEach(feature => {
                            if (feature[station]) {
                                feature[station]['years'].forEach(year => {
                                    let option = document.createElement('option')
                                    option.value = year
                                    option.innerText = year
                                    form[1].appendChild(option)
                                })
                            }
                        })
                    })
                    // loop through stations and create a dropdown option for each one
                    jawn.forEach(station => {
                        let k = Object.keys(station)[0].toString(),
                            option = document.createElement('option')
                        option.value = k
                        option.innerText = k
                        form[0].appendChild(option)
                    })
                    return data = jawn
                })
        }
    })

form.onsubmit = e => {
    e.preventDefault()

    // check if a layer exists on the map already & remove it (map.removeSource())
    if (map.getLayer('hexBins')) {
        map.removeLayer('hexBins')
    }
    let station = e.target[0].value,
        selectedYear = e.target[1].value

    // info to pass to HexStyling function (L212) to apply appropriate color scheme to results
    let stationInfo = {
        'name': station,
        'operator': undefined,
        'mode': undefined,
        'data': [],
        'breaks': []
    }
    // var @data = array returned by fetch on L113 to return summary information about each permutation of commuter shed survey conducted and entered into DB
    data.forEach(i => {
        if (i[station]) {
            stationInfo['operator'] = i[station].operator
            let mode = i[station].mode
            mode.indexOf('(Regional Rail') != -1 ? stationInfo['mode'] = 'Commuter Rail' : stationInfo['mode'] = mode
        }
    })
    // @NOTE: only works locally, on rbeatty's machine. He holds the keys to the castle.
    if (station != 'default') {
        fetch(`https://a.michaelruane.com/api/query?station=${station}&year=${selectedYear}`)
            .then(response => {
                if (response.status == 200) {
                    response.json()
                        .then(jawn => {
                            if (jawn.code) alert(jawn.error)
                            else {
                                // create filter array for hex tile
                                let hex = []
                                for (let k in jawn) {
                                    hex.push(jawn[k].id)
                                    stationInfo['data'].push({
                                        'id': jawn[k].id,
                                        'count': jawn[k].count
                                    })
                                }
                                // filter tile
                                // hex.length != 0 ? map.setFilter('hexBins', ['match', ['get', 'GRID_ID'], hex, true, false]) : map.setFilter('hexBins', ['==', ['get', 'GRID_ID'], ''])

                                // style
                                if (map.getSource('hexBins')) {
                                    map.addLayer(HexStyling(stationInfo, schemes, hex), 'road-label-small')
                                }
                            }
                        })
                }
            }).catch(error => console.error(error))
    }
    else { alert('Please select a station to continue') }
}

let toggle = document.querySelector('.legend__toggle')
toggle.addEventListener('click', e => {
    e.preventDefault()
    let body = e.target.nextElementSibling
    body.classList.toggle('visible')
})
