let currentTask = Promise.resolve();

const chartDiv = "chart";//document.getElementById( "chart" );
const debugCont = document.getElementById( "debug-cont" );
const debug2Cont = document.getElementById( "debug2-cont" );
const sensorsCont = document.getElementById( "sensors-form" );
const sensorsTemplateContent = document.getElementById( "sensors-template" ).innerHTML;


let currentConfig = null;
const sensorsTemplate = Handlebars.compile( sensorsTemplateContent );

function charToInt( char )
{
    return char.charCodeAt( 0 );
}

function renderSensorsConfigForm( sensor_config )
{
    const sensors = Object.entries( sensor_config )
            .map( ( [sid, config] ) => {
                console.log( 'Addr', config['addr'], Array.from( config['addr'] ).map( ( c ) => charToInt( c ) ) )
                return {
                    sid: sid,
                    name: config['name'],
                    field: config['field'],
                    color: config['color'],
                    calibration: config['cal']
                }
            } );
    sensorsCont.innerHTML = sensorsTemplate( {sensors} );
}


function randomColor()
{
    return '#' + Math.floor( Math.random() * 16777215 ).toString( 16 );
}

function runTask( task )
{
    currentTask = currentTask.then( () => task(), () => task() );
    return currentTask;
}

function readConfig()
{
    return runTask( () => {
        return fetch( '/api/config' )
                .then( ( response ) => response.json() )
                .then( ( data ) => {
                    currentConfig = data;
                    debug2Cont.innerHTML = JSON.stringify( data );
                    return data;
                } )
                .catch( ( e ) => {
                    networkList.innerHTML = `Error: ${e}`;
                } );
    } );
}


function updateConfigUI()
{
    alert( 'aaaa' );
    const form = document.getElementById( "update-config-form" );
    const data = new FormData( form );
    const value = Object.fromEntries( data.entries() );
    console.log( value );
}

function readTemperature()
{
    return runTask( () => {
        return fetch( '/api/temperature' )
                .then( ( response ) => response.json() )
                .then( ( data ) => {
                    debugCont.innerHTML = JSON.stringify( data );
                    const time = new Date( (data[0] + currentConfig["time-correction"]) * 1000 );
                    const yUpdate = [];
                    const xUpdate = [];
                    const chartUpdate = [];
                    for( let odx = 1; odx < data.length; odx++ )
                    {
                        const sid = data[odx][0];
                        chartUpdate.push( currentConfig['sensors-config'][sid]["chartInd"] );
                        yUpdate.push( [data[odx][1]] );
                        xUpdate.push( [time] );
                    }
                    console.log( 'Potty update', chartUpdate );
                    Plotly.extendTraces( chartDiv, {y: yUpdate, x: xUpdate}, chartUpdate );
                } )
                .catch( ( e ) => {
                    console.error( 'readTemperature', e );
                } );
    } ).then( () => setTimeout( () => readTemperature(), 1000 ) );
}


readConfig().then( () => {
    const sensorsConfig = currentConfig['sensors-config'];
    const entries = Object.entries( sensorsConfig );
    const plotlyLines = [];
    for( let charIdx = 0; charIdx < entries.length; charIdx++ )
    {
        const [sid, sensorConfig] = entries[charIdx];
        const lineColor = randomColor();
        sensorConfig['color'] = lineColor;
        sensorConfig['chartInd'] = charIdx;
        plotlyLines.push( {
            x: [],
            y: [],
            mode: 'lines',
            line: {color: lineColor}
        } );
    }
    Plotly.newPlot( chartDiv, plotlyLines );
    renderSensorsConfigForm( sensorsConfig );
    return readTemperature();
} );

