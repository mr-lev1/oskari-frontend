import olSourceVector from 'ol/source/Vector';
import olLayerVector from 'ol/layer/Vector';
import { getZoomLevelHelper } from '../../mapmodule/util/scale';

const LayerComposingModel = Oskari.clazz.get('Oskari.mapframework.domain.LayerComposingModel');

/**
 * A Plugin to manage WMTS OpenLayers map layers
 *
 */
Oskari.clazz.define('Oskari.mapframework.wmts.mapmodule.plugin.WmtsLayerPlugin',
    function () {
        this._log = Oskari.log(this.getName());
    }, {
        __name: 'WmtsLayerPlugin',
        _clazz: 'Oskari.mapframework.wmts.mapmodule.plugin.WmtsLayerPlugin',
        layertype: 'wmtslayer',

        getLayerTypeSelector: function () {
            return 'WMTS';
        },

        _initImpl: function () {
            // register domain builder
            const mapLayerService = this.getSandbox().getService('Oskari.mapframework.service.MapLayerService');

            if (!mapLayerService) {
                // no map layer service - TODO: signal failure
                return;
            }
            const className = 'Oskari.mapframework.wmts.domain.WmtsLayer';
            const composingModel = new LayerComposingModel([
                LayerComposingModel.CAPABILITIES,
                LayerComposingModel.CAPABILITIES_STYLES,
                LayerComposingModel.CREDENTIALS,
                LayerComposingModel.GFI_CONTENT,
                LayerComposingModel.GFI_TYPE,
                LayerComposingModel.GFI_XSLT,
                LayerComposingModel.SRS,
                LayerComposingModel.URL,
                LayerComposingModel.VERSION
            ], ['1.0.0']);
            mapLayerService.registerLayerModel(this.layertype, className, composingModel);
            const layerModelBuilder = Oskari.clazz.create('Oskari.mapframework.wmts.service.WmtsLayerModelBuilder');
            mapLayerService.registerLayerModelBuilder(this.layertype, layerModelBuilder);

            this.service = Oskari.clazz.create('Oskari.mapframework.wmts.service.WMTSLayerService', mapLayerService, this.getSandbox());
        },

        /**
         * @method _addMapLayerToMap
         * @private
         * Adds a single Wmts layer to this map
         * @param {Oskari.mapframework.domain.WmtsLayer} layer
         * @param {Boolean} keepLayerOnTop
         * @param {Boolean} isBaseMap
         */
        addMapLayerToMap: function (layer, keepLayerOnTop, isBaseMap) {
            if (!this.isLayerSupported(layer)) {
                return;
            }
            var me = this;
            var map = me.getMap();
            var mapModule = me.getMapModule();
            var wmtsHolderLayer = this._getPlaceHolderWmtsLayer(layer);
            map.addLayer(wmtsHolderLayer);
            this.setOLMapLayers(layer.getId(), wmtsHolderLayer);
            this.service.getCapabilitiesForLayer(layer, function (wmtsLayer) {
                me._log.debug('created WMTS layer ' + wmtsLayer);
                me._registerLayerEvents(wmtsLayer, layer);

                const zoomLevelHelper = getZoomLevelHelper(mapModule.getScaleArray());
                zoomLevelHelper.setOLZoomLimits(wmtsLayer, layer.getMinScale(), layer.getMaxScale());

                // Get the reserved current index for wmts layer
                var holderLayerIndex = mapModule.getLayerIndex(wmtsHolderLayer);
                map.removeLayer(wmtsHolderLayer);
                wmtsLayer.setVisible(layer.isVisible());
                if (keepLayerOnTop) {
                    // use the index as it was when addMapLayer was called
                    // bringing layer on top causes timing errors, because of async capabilities load
                    map.getLayers().insertAt(holderLayerIndex, wmtsLayer);
                } else {
                    map.getLayers().insertAt(0, wmtsLayer);
                }
                me.setOLMapLayers(layer.getId(), wmtsLayer);
                me._updateLayer(layer);
            }, function () {
            });
        },
        /**
         * Reserves correct position for wmts layer, which will be added async later
         * This layer is removed, when the finalized wmts layer will be added
         * @param layer
         * @returns {*}
         * @private
         */
        _getPlaceHolderWmtsLayer: function (layer) {
            var layerHolder = new olLayerVector({
                source: new olSourceVector({}),
                title: 'layer_' + layer.getId(),
                visible: false
            }
            );

            return layerHolder;
        },
        /**
         * Adds event listeners to ol-layers
         * @param {OL3 layer} layer
         * @param {Oskari layerconfig} oskariLayer
         *
         */
        _registerLayerEvents: function (layer, oskariLayer) {
            var me = this;
            var source = layer.getSource();

            source.on('tileloadstart', function () {
                me.getMapModule().loadingState(oskariLayer.getId(), true);
            });

            source.on('tileloadend', function () {
                me.getMapModule().loadingState(oskariLayer.getId(), false);
            });

            source.on('tileloaderror', function () {
                me.getMapModule().loadingState(oskariLayer.getId(), null, true);
            });
        },
        /**
         * Called when layer details are updated (for example by the admin functionality)
         * @param {Oskari.mapframework.domain.AbstractLayer} layer new layer details
         */
        _updateLayer: function (layer) {
            if (!this.isLayerSupported(layer)) {
                return;
            }
            const zoomLevelHelper = getZoomLevelHelper(this.getMapModule().getScaleArray());
            const layersImpls = this.getOLMapLayers(layer.getId()) || [];
            layersImpls.forEach(olLayer => {
                // Update min max Resolutions
                zoomLevelHelper.setOLZoomLimits(olLayer, layer.getMinScale(), layer.getMaxScale());
            });
        }
    }, {
        'extend': ['Oskari.mapping.mapmodule.AbstractMapLayerPlugin'],
        /**
         * @static @property {string[]} protocol array of superclasses
         */
        'protocol': [
            'Oskari.mapframework.module.Module',
            'Oskari.mapframework.ui.module.common.mapmodule.Plugin'
        ]
    }
);
