import React from 'react';
import { stringify } from 'query-string';
import { getLayerHelper } from '../LayerHelper';
import { StateHandler, Messaging, controllerMixin } from 'oskari-ui/util';
import { Message } from 'oskari-ui';
import { handlePermissionForAllRoles, handlePermissionForSingleRole } from './PermissionUtil';

const LayerComposingModel = Oskari.clazz.get('Oskari.mapframework.domain.LayerComposingModel');
const DEFAULT_TAB = 'general';

const getMessage = (key, args) => <Message messageKey={key} messageArgs={args} bundleKey='admin-layereditor' />;

class UIHandler extends StateHandler {
    constructor (consumer) {
        super();
        const mapmodule = Oskari.getSandbox().findRegisteredModuleInstance('MainMapModule');
        this.mapLayerService = Oskari.getSandbox().getService('Oskari.mapframework.service.MapLayerService');
        this.mapLayerService.on('availableLayerTypesUpdated', () => this.updateLayerTypeVersions());
        this.log = Oskari.log('AdminLayerFormHandler');
        this.loadingCount = 0;
        this.layerHelper = getLayerHelper();
        this.setState({
            layer: {},
            layerTypes: this.mapLayerService.getLayerTypes(),
            versions: [],
            propertyFields: [],
            capabilities: {},
            messages: [],
            loading: false,
            tab: DEFAULT_TAB,
            credentialsCollapseOpen: false,
            scales: mapmodule.getScaleArray().map(value => typeof value === 'string' ? parseInt(value) : value)
        });
        this.addStateListener(consumer);
        this.fetchLayerAdminMetadata();
    }

    updateLayerTypeVersions () {
        const { layer } = this.getState();
        this.updateState({
            layerTypes: this.mapLayerService.getLayerTypes(),
            versions: this.mapLayerService.getVersionsForType(layer.type)
        });
    }
    setType (type) {
        const layer = { ...this.getState().layer, type };
        this.updateState({
            layer,
            versions: this.mapLayerService.getVersionsForType(type),
            propertyFields: this.getPropertyFields(layer)
        });
    }
    setLayerUrl (url) {
        this.updateState({
            layer: { ...this.getState().layer, url }
        });
    }
    versionSelected (version) {
        const layer = { ...this.getState().layer, version };
        if (typeof version === 'undefined') {
            // object spread doesn't work when removing value == returning from manually adding layer/skipping capabilities
            delete layer.version;
            // if we are returning we also need to clear name
            delete layer.name;
        }
        const propertyFields = this.getPropertyFields(layer);
        if (!version) {
            // for moving back to previous step
            this.updateState({ layer, capabilities: {}, propertyFields });
            return;
        }
        if (!propertyFields.includes(LayerComposingModel.CAPABILITIES)) {
            this.updateState({ layer, propertyFields });
            return;
        };
        this.fetchCapabilities(layer);
    }
    setVersion (version) {
        const layer = { ...this.getState().layer, version };
        const propertyFields = this.getPropertyFields(layer);
        this.updateState({ layer, propertyFields });
    }
    layerSelected (name) {
        const { capabilities, layer } = this.getState();
        if (!capabilities || !capabilities.layers) {
            this.log.error('Capabilities not available. Tried to select layer: ' + name);
            return;
        }
        const found = capabilities.layers[name];
        if (found) {
            const typesAndRoles = this.getAdminMetadata();
            const updateLayer = this.layerHelper.fromServer({ ...layer, ...found }, {
                preserve: ['capabilities'],
                roles: typesAndRoles.roles
            });
            this.updateState({
                layer: updateLayer,
                propertyFields: this.getPropertyFields(updateLayer)
            });
        } else {
            this.log.error('Layer not in capabilities: ' + name);
        }
    }
    skipCapabilities () {
        // force an OGC service to skip the capabilities phase of the wizard since some services are not standard compliant
        // This is a last ditch effort to support such services.
        const layer = {
            name: '',
            version: '',
            ...this.getState().layer
        };
        this.updateState({ layer });
    }
    addNewFromSameService () {
        // initialize state for adding a new layer from the same OGC service (service having capabilities)
        const state = this.getState();
        const layer = { ...state.layer };
        const capabilities = state.capabilities || { existingLayers: {} };
        // add newly added layer to "existing layers" so it's shown as existing
        capabilities.existingLayers[layer.name] = state.layer;
        // delete name for "new" layer so we are taken back to the capabilities layer listing
        delete layer.name;
        // delete layer id so we won't modify the one we just added
        delete layer.id;
        this.updateState({ layer, capabilities });
    }
    setUsername (username) {
        this.updateState({
            layer: { ...this.getState().layer, username }
        });
    }
    setPassword (password) {
        this.updateState({
            layer: { ...this.getState().layer, password }
        });
    }
    setLayerName (name) {
        this.updateState({
            layer: { ...this.getState().layer, name }
        });
    }
    setSelectedTime (selectedTime) {
        const layer = { ...this.getState().layer };
        if (!layer.params) {
            layer.params = {};
        }
        layer.params.selectedTime = selectedTime;
        this.updateState({ layer });
    }
    setRealtime (realtime) {
        this.updateState({
            layer: { ...this.getState().layer, realtime }
        });
    }
    setRefreshRate (refreshRate) {
        this.updateState({
            layer: { ...this.getState().layer, refreshRate }
        });
    }
    setCapabilitiesUpdateRate (capabilitiesUpdateRate) {
        this.updateState({
            layer: { ...this.getState().layer, capabilitiesUpdateRate }
        });
    }
    setForcedSRS (forcedSRS) {
        const layer = { ...this.getState().layer };
        let attributes = layer.attributes || {};
        if (!Array.isArray(forcedSRS) || forcedSRS.length === 0) {
            delete attributes.forcedSRS;
        } else {
            attributes = { ...attributes, forcedSRS };
        }
        this.updateLayerAttributes(attributes, layer);
    }
    setLocalizedNames (locale) {
        this.updateState({
            layer: { ...this.getState().layer, locale }
        });
    }
    setDataProviderId (dataProviderId) {
        this.updateState({
            layer: { ...this.getState().layer, dataProviderId }
        });
    }
    setGroup (checked, group) {
        const layer = { ...this.getState().layer };
        if (checked) {
            layer.groups = Array.from(new Set([...layer.groups, group.id]));
        } else {
            const found = layer.groups.find(cur => cur === group.id);
            if (found) {
                layer.groups = [...layer.groups];
                layer.groups.splice(layer.groups.indexOf(found), 1);
            }
        }
        this.updateState({ layer });
    }
    setOpacity (opacity) {
        this.updateState({
            layer: { ...this.getState().layer, opacity }
        });
    }
    setClusteringDistance (clusteringDistance) {
        const layer = { ...this.getState().layer };
        layer.options.clusteringDistance = clusteringDistance;
        this.updateState({ layer });
    }
    setRenderMode (renderMode) {
        const layer = { ...this.getState().layer };
        layer.options.renderMode = renderMode;
        this.updateState({ layer });
    }
    getResolutionArray () {
        return [ ...this.mapmodule.getResolutionArray() ];
    }
    setMinAndMaxScale ([ minscale, maxscale ]) {
        this.updateState({
            layer: {
                ...this.getState().layer,
                minscale,
                maxscale
            }
        });
    }
    setStyle (style) {
        this.updateState({
            layer: { ...this.getState().layer, style }
        });
    }
    setStyleJSON (json) {
        this.updateOptionsJsonProperty(json, 'tempStylesJSON', 'styles');
    }
    setExternalStyleJSON (json) {
        this.updateOptionsJsonProperty(json, 'tempExternalStylesJSON', 'externalStyles');
    }
    setHoverJSON (json) {
        this.updateOptionsJsonProperty(json, 'tempHoverJSON', 'hover');
    }
    setTileGridJSON (json) {
        this.updateOptionsJsonProperty(json, 'tempTileGridJSON', 'tileGrid');
    }
    setAttributionsJSON (json) {
        this.updateOptionsJsonProperty(json, 'tempAttributionsJSON', 'attributions');
    }
    updateOptionsJsonProperty (json, jsonPropKey, dataPropKey) {
        const layer = { ...this.getState().layer };
        layer[jsonPropKey] = json;
        if (json === '') {
            delete layer.options[dataPropKey];
            this.updateState({ layer });
            return;
        }
        try {
            layer.options[dataPropKey] = JSON.parse(json);
        } catch (err) {
            // Don't update the form data, just the temporary input.
        }
        this.updateState({ layer });
    }
    setOptions (options) {
        this.updateState({
            layer: { ...this.getState().layer, options }
        });
    }
    setMetadataIdentifier (metadataid) {
        this.updateState({
            layer: { ...this.getState().layer, metadataid }
        });
    }
    setLegendImage (legendImage) {
        this.updateState({
            layer: { ...this.getState().layer, legendImage }
        });
    }
    setGfiContent (gfiContent) {
        this.updateState({
            layer: { ...this.getState().layer, gfiContent }
        });
    }
    setGfiType (gfiType) {
        this.updateState({
            layer: { ...this.getState().layer, gfiType }
        });
    }
    setGfiXslt (gfiXslt) {
        this.updateState({
            layer: { ...this.getState().layer, gfiXslt }
        });
    }
    setQueryFormat (value) {
        const layer = { ...this.getState().layer };
        if (!layer.format) {
            layer.format = {};
        }
        layer.format.value = value;
        this.updateState({ layer });
    }
    setAttributes (tempAttributesJSON) {
        const layer = { ...this.getState().layer, tempAttributesJSON };
        let tempAttributes = {};
        try {
            tempAttributes = JSON.parse(tempAttributesJSON);
        } catch (err) { }

        const isEmpty = Object.keys(tempAttributes).length === 0;
        if (isEmpty && !layer.attributes) {
            this.updateState({ layer });
            return;
        }
        if (!isEmpty) {
            // format text input
            layer.tempAttributesJSON = this.layerHelper.toJson(tempAttributes);
        }

        // Delete missing attibute keys but keep managed attributes
        const managedAttributes = ['forcedSRS'];
        Object.keys(layer.attributes)
            .filter(key => !managedAttributes.includes(key))
            .forEach(key => delete layer.attributes[key]);

        this.updateLayerAttributes({ ...layer.attributes, ...tempAttributes }, layer);
    }
    updateLayerAttributes (attributes, layer = { ...this.getState().layer }) {
        layer.attributes = attributes;
        // Update text input
        if (layer.tempAttributesJSON) {
            try {
                if (typeof JSON.parse(layer.tempAttributesJSON) === 'object') {
                    layer.tempAttributesJSON = this.layerHelper.toJson(layer.attributes);
                }
            } catch (err) {
                // Don't override the user input. The user might lose some data.
            }
        }
        this.updateState({ layer });
    }
    setMessage (key, type, args) {
        this.updateState({
            messages: [{ key, type, args }]
        });
    }
    setMessages (messages) {
        this.updateState({ messages });
    }
    setTab (tab) {
        this.updateState({ tab });
    }
    resetLayer () {
        const typesAndRoles = this.getAdminMetadata();
        this.updateState({
            layer: this.layerHelper.createEmpty(typesAndRoles.roles),
            capabilities: {},
            versions: [],
            propertyFields: [],
            tab: DEFAULT_TAB
        });
    }
    ajaxStarted () {
        this.updateLoadingState(true);
    }
    ajaxFinished () {
        this.updateLoadingState(false);
    }
    updateLoadingState (loadingStarted) {
        if (loadingStarted) {
            this.loadingCount++;
        } else {
            this.loadingCount--;
        }
        this.updateState({
            loading: this.isLoading()
        });
    }
    getPropertyFields (layer) {
        const { type, version } = layer;
        const composingModel = this.mapLayerService.getComposingModelForType(type);
        return composingModel ? composingModel.getPropertyFields(version) : [];
    }

    // http://localhost:8080/action?action_route=LayerAdmin&id=889
    fetchLayer (id) {
        this.clearMessages();
        if (!id) {
            this.resetLayer();
            return;
        }
        this.ajaxStarted();
        fetch(Oskari.urls.getRoute('LayerAdmin', { id }), {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        }).then(response => {
            this.ajaxFinished();
            if (!response.ok) {
                Messaging.error('TODO');
            }
            return response.json();
        }).then(json => {
            const typesAndRoles = this.getAdminMetadata();
            const { ...layer } = this.layerHelper.fromServer(json, {
                preserve: ['capabilities'],
                roles: typesAndRoles.roles
            });
            if (layer.warn) {
                // currently only option for warning on this is "updateCapabilitiesFail"
                Messaging.warn(getMessage(`messages.${layer.warn}`));
                delete layer.warn;
            }
            this.updateState({
                layer,
                propertyFields: this.getPropertyFields(layer),
                versions: this.mapLayerService.getVersionsForType(layer.type)
            });
        });
    }

    saveLayer () {
        const validationErrorMessages = this.validateUserInputValues(this.getState().layer);
        if (validationErrorMessages.length > 0) {
            // TODO: formatting message and message duration
            Messaging.error(<ul>{ validationErrorMessages
                .map(msg => <li key={msg}>{msg}</li>)}
            </ul>);
            return;
        }
        // Take a copy
        const layer = { ...this.getState().layer };
        // Modify layer for backend
        const layerPayload = this.layerHelper.toServer(layer);

        fetch(Oskari.urls.getRoute('LayerAdmin'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(layerPayload)
        }).then(response => {
            if (response.ok) {
                Messaging.success(getMessage('messages.saveSuccess'));
                return response.json();
            } else {
                Messaging.error(getMessage('messages.saveFailed'));
                return Promise.reject(Error('Save failed'));
            }
        }).then(data => {
            // FIXME: layer data will be the same as for editing == admin data
            // To get the layer json for "end-user" frontend for creating
            // an AbstractLayer-based model -> make another request to get that JSON.
            Messaging.warn('Reload page to see changes for end user - Work in progress...');
            this.fetchLayer(data.id);
            /*
            if (layer.id) {
                data.groups = layer.groups;
                this.updateLayer(layer.id, data);
            } else {
                this.createlayer(data);
            }
            */
        }).catch(error => this.log.error(error));
    }

    updateLayer (layerId, layerData) {
        this.mapLayerService.updateLayer(layerId, layerData);
    }

    createlayer (layerData) {
        // TODO: Test this method when layer creation in tested with new wizard
        const mapLayer = this.mapLayerService.createMapLayer(layerData);

        if (layerData.baseLayerId) {
            // If this is a sublayer, add it to its parent's sublayer array
            this.mapLayerService.addSubLayer(layerData.baseLayerId, mapLayer);
        } else {
            // Otherwise just add it to the map layer service.
            if (this.mapLayerService._reservedLayerIds[mapLayer.getId()] !== true) {
                this.mapLayerService.addLayer(mapLayer);
            } else {
                Messaging.error(getMessage('messages.errorInsertAllreadyExists'));
                // should we update if layer already exists??? mapLayerService.updateLayer(e.layerData.id, e.layerData);
            }
        }
    }

    validateUserInputValues (layer) {
        const validationErrors = [];
        if (!layer.dataProviderId || layer.dataProviderId === -1) {
            validationErrors.push(getMessage('validation.dataprovider'));
        }
        if (!this.hasAnyPermissions(layer.role_permissions)) {
            validationErrors.push(getMessage('validation.nopermissions'));
        }
        const loc = layer.locale || {};
        const defaultLang = Oskari.getSupportedLanguages()[0];
        const defaultLocale = loc[defaultLang] || {};
        if (!defaultLocale.name) {
            validationErrors.push(getMessage('validation.locale'));
        }

        let mandatoryFields = this.getMandatoryFieldsForType(layer.type);
        const getValue = (item, key) => {
            if (!item || !key) {
                return;
            }
            const keyParts = key.split('.');
            if (keyParts.length === 1) {
                // undefined or trimmed value
                return item[key] && item[key].trim();
            }
            let newItem = item[keyParts.shift()];
            // recurse with new item and parts left on the key
            return getValue(newItem, keyParts.join('.'));
        };
        mandatoryFields.forEach(field => {
            const value = getValue(layer, field);
            if (!value || value === -1) {
                validationErrors.push(getMessage('validation.' + field));
            }
        });

        this.validateJsonValue(layer.tempStylesJSON, 'validation.styles', validationErrors);
        this.validateJsonValue(layer.tempExternalStylesJSON, 'validation.externalStyles', validationErrors);
        this.validateJsonValue(layer.tempHoverJSON, 'validation.hover', validationErrors);
        this.validateJsonValue(layer.tempAttributesJSON, 'validation.attributes', validationErrors);
        this.validateJsonValue(layer.tempAttributionsJSON, 'validation.attributions', validationErrors);
        this.validateJsonValue(layer.tempTileGridJSON, 'validation.tileGrid', validationErrors);
        return validationErrors;
    }

    hasAnyPermissions (permissions = {}) {
        return Object.keys(permissions).filter(role => {
            return (permissions[role] || []).length > 0;
        }).length > 0;
    }

    validateJsonValue (value, msgKey, validationErrors) {
        if (value === '' || typeof value === 'undefined') {
            return;
        }
        try {
            const result = JSON.parse(value);
            if (typeof result !== 'object') {
                Messaging.error(getMessage(msgKey));
                // TODO fix error checking logic, get rid of validationErrors array
                validationErrors.push(true);
            }
        } catch (error) {
            Messaging.error(getMessage(msgKey));
            validationErrors.push(true);
        }
    }

    deleteLayer () {
        // FIXME: This should use LayerAdmin route instead but this probably works anyway
        const { layer } = this.getState();
        fetch(Oskari.urls.getRoute('DeleteLayer'), {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: stringify(layer)
        }).then(response => {
            if (response.ok) {
                // TODO handle this, just close the flyout?
            } else {
                Messaging.error(getMessage('messages.errorRemoveLayer'));
            }
            return response;
        });
    }

    /*
        Calls action route like:
        http://localhost:8080/action?action_route=LayerAdmin&url=https://my.domain/geoserver/ows&type=wfslayer&version=1.1.0
    */
    fetchCapabilities (layer = this.getState().layer) {
        this.ajaxStarted();
        var params = {
            type: layer.type,
            version: layer.version,
            url: layer.url,
            user: layer.username,
            pw: layer.password
        };

        // Remove undefined params
        Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);

        fetch(Oskari.urls.getRoute('ServiceCapabilities', params), {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        }).then(response => {
            this.ajaxFinished();
            if (response.ok) {
                return response.json();
            } else {
                if (response.status === 401) {
                    Messaging.warn(getMessage('messages.unauthorizedErrorFetchCapabilities'));
                    this.updateState({ credentialsCollapseOpen: true });
                } else if (response.status === 408) {
                    // timeout when calling service
                    Messaging.warn(getMessage('messages.timeoutErrorFetchCapabilities'));
                } else if (response.status === 400) {
                    // other connection issues when calling service
                    Messaging.warn(getMessage('messages.connectionErrorFetchCapabilities'));
                } else if (response.status === 417) {
                    // response from the service was not what we expected/parsing problem
                    Messaging.warn(getMessage('messages.parsingErrorFetchCapabilities'));
                } else {
                    // generic error
                    Messaging.error(getMessage('messages.errorFetchCapabilities'));
                }
                return Promise.reject(new Error('Capabilities fetching failed with status code ' + response.status + ' and text ' + response.statusText));
            }
        }).then(json => {
            const updateLayer = { ...layer };
            this.updateState({
                capabilities: json || {},
                layer: updateLayer,
                propertyFields: this.getPropertyFields(updateLayer)
            });
        }).catch(error => {
            this.log.error(error);
        });
    }

    updateCapabilities () {
        const { layer } = this.getState();
        const params = {
            id: layer.id,
            srs: Oskari.getSandbox().getMap().getSrsName()
        };
        const updateFailed = reason => {
            const errorMsgKey = reason ? 'capabilities.updateFailedWithReason' : 'capabilities.updateFailed';
            Messaging.error(getMessage(errorMsgKey, { reason }));
        };
        this.ajaxStarted();
        fetch(Oskari.urls.getRoute('UpdateCapabilities', params), {
            method: 'POST',
            headers: {
                'Accept': 'application/json'
            }
        }).then(response => {
            this.ajaxFinished();
            if (response.ok) {
                return response.json();
            } else {
                return Promise.reject(new Error('Updating capabilities failed'));
            }
        }).then(data => {
            const { success, error, layerData = {} } = data;
            if (success.includes(`${layer.id}`)) {
                this.updateState({
                    capabilities: layerData.capabilities,
                    messages: [{ key: 'capabilities.updatedSuccesfully', type: 'success' }]
                });
            } else {
                if (error) {
                    updateFailed(Object.values(error)[0]);
                    return;
                };
                updateFailed();
            }
        }).catch(error => {
            updateFailed();
            this.log.error(error);
        });
    }

    fetchLayerAdminMetadata () {
        this.ajaxStarted();
        fetch(Oskari.urls.getRoute('LayerAdminMetadata'))
            .then(response => {
                if (response.ok) {
                    return response.json();
                } else {
                    return Promise.reject(new Error('Fetching user roles and permission types failed'));
                }
            }).then(data => {
                this.loadingCount--;
                const currentLayer = this.getState().layer;
                this.layerHelper.initPermissionsForLayer(currentLayer, data.roles);
                this.updateState({
                    currentLayer,
                    loading: this.isLoading(),
                    metadata: data
                });
            }).catch(error => {
                this.log.error(error);
                Messaging.error('messages.errorFetchUserRolesAndPermissionTypes');
            });
    }
    /**
     * Object with roles and permissionTypes objects that are needed to create the UI that
     * matches the configuration of the system
     */
    getAdminMetadata () {
        return this.getState().metadata || {};
    }

    getMandatoryFieldsForType (type) {
        const metadata = this.getAdminMetadata().layerTypes || {};
        const mandatoryFields = metadata[type] || [];
        // TODO: add dataproviderId, role_permissions, default locale?
        return mandatoryFields;
    }

    isLoading () {
        return this.loadingCount > 0;
    }
    clearMessages () {
        this.updateState({
            messages: []
        });
    }

    clearCredentialsCollapse () {
        this.updateState({ credentialsCollapseOpen: false });
    }
    setPermissionForAll (permission, enabled) {
        const layer = this.getState().layer;
        handlePermissionForAllRoles(enabled, layer.role_permissions, permission);
        this.updateState({ layer });
    }
    togglePermission (role, permission) {
        const layer = this.getState().layer;
        handlePermissionForSingleRole(layer.role_permissions, permission, role);

        this.updateState({ layer });
    }
}

const wrapped = controllerMixin(UIHandler, [
    'addNewFromSameService',
    'layerSelected',
    'setAttributes',
    'setAttributionsJSON',
    'setCapabilitiesUpdateRate',
    'setClusteringDistance',
    'setDataProviderId',
    'setExternalStyleJSON',
    'setForcedSRS',
    'setGfiContent',
    'setGfiType',
    'setGfiXslt',
    'setGroup',
    'setHoverJSON',
    'setLayerName',
    'setLayerUrl',
    'setLegendImage',
    'setLocalizedNames',
    'setMessage',
    'setMessages',
    'setMetadataIdentifier',
    'setMinAndMaxScale',
    'setOpacity',
    'setOptions',
    'setPassword',
    'setPermissionForAll',
    'setRealtime',
    'setRefreshRate',
    'setRenderMode',
    'setSelectedTime',
    'setStyle',
    'setStyleJSON',
    'setTileGridJSON',
    'setType',
    'setUsername',
    'setVersion',
    'setTab',
    'skipCapabilities',
    'togglePermission',
    'updateCapabilities',
    'versionSelected'
]);
export { wrapped as AdminLayerFormHandler };