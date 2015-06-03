$(document).ready(function () {
    $('#history').on('click', function () {
        history();
    });

    $('#by_day').on('click', function () {
        by_day();
    });

    $('#costs').on('click', function () {
        costs();
    });

    function history() {
        $(".day_navigation").hide();
        $.getJSON('/power/history', function (json) {
            var dataWithDates = [];
            _(json.data).forEach(function (point) {
                dataWithDates.push([Date.parse(point[0]), point[1]]);
            });
            createHistoryChart('#chart', dataWithDates);
        });
    }

    function by_day() {
        $(".day_navigation").show();
        var today_at_midnight = new Date();
        today_at_midnight.setHours(0, 0, 0, 0);
        $.getJSON('/power/day/' + today_at_midnight.getTime() / 1000, function (json) {
            createDayChart('#chart', json);
        });
    }


    function costs() {
        $(".day_navigation").hide();
        $.getJSON('/power/costs/' + 7 * 24 * 3600, function (json) {
            createCostChart('#chart', json);
        });
    }


    Highcharts.setOptions({
        global: {
            useUTC: false
        }
    });

    function createHistoryChart(selector, jsonData) {
        $(selector).highcharts({
            chart: {
                zoomType: 'x'
            },
            title: {
                text: 'Historique de consommation électrique par jour'
            },
            subtitle: {
                text: document.ontouchstart === undefined ?
                    'sélectionner une zone dans le graph pour zoomer' :
                    'Pinch the chart to zoom in'
            },
            xAxis: {
                type: 'datetime',
                minRange: 24 * 3600000 // one day
            },
            yAxis: {
                title: {
                    text: 'puissance (kWh)'
                },
                min: 0
            },
            legend: {
                enabled: false
            },
            plotOptions: {
                area: {
                    fillColor: {
                        linearGradient: {x1: 0, y1: 0, x2: 0, y2: 1},
                        stops: [
                            [0, Highcharts.getOptions().colors[0]],
                            [1, Highcharts.Color(Highcharts.getOptions().colors[0]).setOpacity(0).get('rgba')]
                        ]
                    },
                    marker: {
                        radius: 2
                    },
                    lineWidth: 1,
                    states: {
                        hover: {
                            lineWidth: 1
                        }
                    },
                    threshold: null
                }
            },
            series: [{
                type: 'area',
                name: 'Consommation',
                data: jsonData
            }]
        });
    }

    function createDayChart(selector, jsonData) {
        $(selector).highcharts({
            chart: {
                zoomType: 'x'
            },
            title: {
                text: 'Consommation électrique du ' + jsonData[0][0]
            },
            xAxis: {
                type: 'datetime',
                dateTimeLabelFormats: {
                    hour: '%H:%M',
                    day: '%H:%M',
                    week: '%H:%M',
                    month: '%H:%M'
                }
            },
            yAxis: [{
                title: {
                    text: 'Heure Base',
                    style: {
                        color: '#4572A7'
                    }
                },
                labels: {
                    format: '{value} W',
                    style: {
                        color: '#4572A7'
                    }
                },
                alternateGridColor: '#FAFAFA',
                minorGridLineWidth: 0,
                plotLines: [
                    {
                        value: jsonData.seuils.max,
                        color: 'red',
                        dashStyle: 'shortdash',
                        width: 2,
                        label: {
                            text: 'maximum ' + jsonData.seuils.max + 'w'
                        }
                    }
                ]
            }, {
                labels: {
                    format: '{value}°C',
                    style: {
                        color: '#910000'
                    }
                },
                title: {
                    text: 'Temperature',
                    style: {
                        color: '#910000'
                    }
                },
                opposite: true
            }],
            tooltip: {
                shared: true
            },
            legend: {
                layout: 'vertical',
                align: 'left',
                x: 100,
                verticalAlign: 'top',
                y: 40,
                floating: true,
                backgroundColor: '#FFFFFF'
            },
            series: [{
                name: jsonData.BASE_name,
                color: '#4572A7',
                type: 'areaspline',
                data: jsonData.BASE_data,
                tooltip: {
                    valueSuffix: ' W'
                }
            }, {
                name: jsonData.Temp_name,
                data: jsonData.Temp_data,
                color: '#910000',
                yAxis: 1,
                type: 'spline',
                tooltip: {
                    valueSuffix: '°C'
                }
            }, {
                name: jsonData.JPrec_name,
                data: jsonData.JPrec_data,
                color: '#89A54E',
                type: 'spline',
                width: 1,
                shape: 'squarepin',
                tooltip: {
                    valueSuffix: ' W'
                }
            }]
        });
    }

    function createCostChart(selector, jsonData) {
        $(selector).highcharts({
                chart: {
                    defaultSeriesType: 'column',
                },
                title: {
                    text: 'Consommation électrique'
                },
                xAxis: [
                    {
                        categories: data.categories
                    }
                ],
                yAxis: {
                    title: {
                        text: 'kWh'
                    },
                    min: 0,
                    minorGridLineWidth: 0,
                    labels: {formatter: function () { return this.value + ' kWh' }}
                },
                tooltip: {
                    formatter: function () {
                        totalBASE = data.prix.BASE * ((this.series.name == 'Heures de Base') ? this.y : this.point.stackTotal - this.y);
                        totalHP = data.prix.HP * ((this.series.name == 'Heures Pleines') ? this.y : this.point.stackTotal - this.y);
                        totalHC = data.prix.HC * ((this.series.name == 'Heures Creuses') ? this.y : this.point.stackTotal - this.y);
                        totalprix = Highcharts.numberFormat(( totalBASE + totalHP + totalHC + data.prix.abonnement ), 2);
                        tooltip = '<b> ' + this.x + ' <b><br /><b>' + this.series.name + ' ' + Highcharts.numberFormat(this.y, 2) + ' kWh<b><br />';
                        //tooltip += 'BASE : '+ Highcharts.numberFormat(totalBASE,2) + ' Euro / HP : '+ Highcharts.numberFormat(totalHP,2) + ' Euro / HC : ' + Highcharts.numberFormat(totalHC,2) + ' Euro<br />';
                        if (data.tarif_type != "HCHP") {
                            tooltip += 'BASE : ' + Highcharts.numberFormat(totalBASE, 2) + ' Euro <br />';
                        } else {
                            tooltip += 'HP : ' + Highcharts.numberFormat(totalHP, 2) + ' Euro / HC : ' + Highcharts.numberFormat(totalHC, 2) + ' Euro<br />';
                        }
                        tooltip += 'Abonnement sur la période : ' + Highcharts.numberFormat(data.prix.abonnement, 2) + ' Euro<br />';
                        tooltip += '<b> Total: ' + totalprix + ' Euro<b>';
                        return tooltip;
                    }
                },
                plotOptions: {
                    column: {
                        stacking: 'normal'
                    }
                },
                series: [
                    {
                        name: data.HP_name,
                        data: data.HP_data,
                        dataLabels: {
                            enabled: true,
                            color: '#FFFFFF',
                            y: 13,
                            formatter: function () {
                                return this.y;
                            },
                            style: {
                                font: 'normal 13px Verdana, sans-serif'
                            }
                        },
                        type: 'column',
                        showInLegend: ((data.tarif_type == "HCHP") ? true : false)
                    },
                    {
                        name: data.HC_name,
                        data: data.HC_data,
                        dataLabels: {
                            enabled: true,
                            color: '#FFFFFF',
                            y: 13,
                            formatter: function () {
                                return this.y;
                            },
                            style: {
                                font: 'normal 13px Verdana, sans-serif'
                            }
                        },
                        type: 'column',
                        showInLegend: ((data.tarif_type == "HCHP") ? true : false)
                    },
                    {
                        name: data.BASE_name,
                        data: data.BASE_data,
                        events: {
                            click: function (e) {
                                var newdate = new Date();
                                newdate.setTime(data.debut);
                                newdate.setDate(newdate.getDate() + e.point.x);
                            }
                        },
                        dataLabels: {
                            enabled: true,
                            color: '#FFFFFF',
                            y: 13,
                            formatter: function () {
                                return this.y;
                            },
                            style: {
                                font: 'normal 13px Verdana, sans-serif'
                            }
                        },
                        type: 'column',
                        showInLegend: ((data.tarif_type == "HCHP") ? false : true)
                    }
                ],
                navigation: {
                    menuItemStyle: {
                        fontSize: '10px'
                    }
                }
            }
        );
    }

    history();
});