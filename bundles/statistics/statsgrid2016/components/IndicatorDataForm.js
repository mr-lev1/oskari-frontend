/**
 * Generic form for feeding values for regions. Triggers events on cancel and save.
 */
Oskari.clazz.define('Oskari.statistics.statsgrid.IndicatorDataForm', function (locale) {
    this.locale = locale;
    this.selectors = {};
    this.element = this.createUi();
    Oskari.makeObservable(this);
}, {
    __templates: {
        main: _.template('<div class="user-indicator-main"></div>'),
        insertTable: _.template('<table class="user-indicator-table">' +
                                        '<tbody></tbody>' +
                                '</table>'),
        header: _.template('<div class="user-indicator-specification">' +
                                '<div>${regionsetLabel}: ${regionset}</div>' +
                                '<div>${yearLabel}: ${year}</div>' +
                            '</div>'),
        row: _.template('<tr data-id="${regionId}">' +
                            '<td class="region" style=" border: 1px solid black ;">${regionName}</td>' +
                            '<td class="uservalue" contenteditable=true style=" border: 1px solid black ;">${value}</td>' +
                        '</tr> ')
    },
    getElement: function () {
        return this.element;
    },
    createUi: function () {
        if (this.getElement()) {
            return this.getElement();
        }
        return jQuery(this.__templates.main());
    },
    clearUi: function () {
        if (!this.getElement()) {
            return;
        }
        this.getElement().empty();
    },
    fillTable: function (data) {
        var table = this.getElement().find('.user-indicator-table');
        data.forEach(function (iteration) {
            table.find('tr').filter(function (index, tr) {
                if (tr.innerText.trim() === iteration.name) {
                    jQuery(tr).find('td.uservalue').text(iteration.value);
                }
            });
        });
    },
    showTable: function (selectors, regions, labels) {
        var me = this;
        this.clearUi();
        labels = labels || {};
        this.selectors = selectors || {};

        var header = this.__templates.header({
            regionsetLabel: this.locale('panels.newSearch.regionsetTitle'),
            yearLabel: this.locale('parameters.year'),
            regionset: labels[selectors.regionset] || selectors.regionset,
            year: labels[selectors.year] || selectors.year
        });
        this.getElement().append(header);

        var tableRef = jQuery(this.__templates.insertTable());
        regions.forEach(function (region) {
            tableRef.append(me.__templates.row({
                regionId: region.id,
                regionName: region.name,
                value: region.value || ''
            }));
        });
        this.getElement().append(tableRef);
        // Focus on the first input cell
        tableRef.find('tr td.uservalue')[0].focus();
        var cancelBtn = Oskari.clazz.create('Oskari.userinterface.component.buttons.CancelButton');
        cancelBtn.insertTo(this.getElement());
        cancelBtn.setHandler(function () {
            me.trigger('cancel');
            me.clearUi();
        });
        var showTableBtn = Oskari.clazz.create('Oskari.userinterface.component.buttons.AddButton');
        showTableBtn.insertTo(this.getElement());
        showTableBtn.setHandler(function () {
            me.trigger('save', me.getValues());
        });
    },
    getValues: function () {
        var table = this.getElement().find('table');
        var data = {
            selectors: this.selectors,
            values: []
        };
        table.find('tr').each(function (index, element) {
            var row = jQuery(element);
            var columns = row.find('td');
            var dataItem = {
                id: row.attr('data-id'),
                name: columns[0].innerText,
                value: columns[1].innerText.trim()
            };
            if (dataItem.value !== '' && !Number.isNaN(dataItem.value)) {
                // only include rows with values and cast value to number as legend expects it to be a number
                dataItem.value = dataItem.value.replace(/,/g, '.');
                dataItem.value = Number(dataItem.value);
                data.values.push(dataItem);
            }
        });
        return data;
    }
});
