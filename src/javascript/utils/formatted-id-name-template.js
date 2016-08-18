
Ext.define('CArABU.technicalservices.PredecessorTemplate', {
        extend: 'Ext.XTemplate',

        /**
         * @cfg {Boolean}
         * Whether to show the icon next to the formatted id
         */
        showIcon: true,

        /**
         * @cfg {Boolean}
         * Render the FormattedID as plain text instead of a hyperlink to the artifact.
         */
        renderIdAsText: false,

        constructor: function (config) {
           // this.scheduleStates = config.scheduleStates;
            return this.callParent([
                '<tpl if="values.length!=0"><table class="predecessors-table"><thead><th class="predecessors-header">Name</th><th class="predecessors-header">Schedule State</th><th class="predecessors-header">Team</th><th class="predecessors-header">Iteration</th><th class="predecessors-header">Predecessors</th></thead>',
                '<tpl for="."><tr>',
                '<td><span class="formatted-id-template">{[this.createIdValue(values)]}</span>: {Name}</td>',
                '<td><div aria-label="Edit Schedule State: {ScheduleState}"',
                    ' class="schedule-state-wrapper {[this._addClsIfEditable(values)]}" style="width: 100%">',
                    '{[this.renderStates(values)]}',
                    '</div></td>',
                '<td>{[this.getReferenceAttribute(values, "Project", "Name")]}</td>',
                '<td>{[this.getReferenceAttribute(values, "Iteration","Name","Unscheduled")]}</td>',
                '<td><tpl if="this._getDependenciesCount(values) &gt; 0">',
                '<a onclick="{[this._getOnClick(values)]}">',
                    '<span class="predecessorsandsuccessors-cnt">{[this._getDependenciesCount(values)]}</span>',
                    '</a>',
                '</tpl></td>',
                '</tr></tpl></table></tpl>' +
                '<tpl if="values.length == 0">',
                '<div class="predecessor">Predecessors exist for this story, but are not within the viewable permissions of the current user</div>',
                '</tpl>',
                config
            ]);


        },
        _addClsIfEditable: function(recordData) {
            return recordData.updatable ?  'field-editable' : '';
        },
        _getDependenciesCount: function (recordData) {
            return recordData.Predecessors.Count;
        },
        _getOnClick: function(recordData) {
            return 'Rally.ui.renderer.template.status.PredecessorsAndSuccessorsStatusTemplate.onClick(event, \'' + recordData._ref + '\'); return false;';
        },
    renderStates: function(recordData) {
        var states = this.scheduleStates;
        var stateUsed = true;
        var returnVal = [];
        var currentState = recordData['ScheduleState'];
        var blockWidth = Math.floor((85/(states.length))-3);

        Ext.each(states, function(state, index) {
            //don't add spacer at the front
            if(index !== 0) {
                returnVal.push('<span class="schedule-state-spacer"></span>');
            }

            //render an individual state block
            returnVal.push('<div state-data="' + state + '" class="schedule-state');
            returnVal.push(this._getClassFromState(recordData.Blocked, recordData.Ready));

            if (stateUsed) {
                returnVal.push(' before-state');
            }

            if (state === currentState) {
                var symbolState = this._getSymbolState(recordData, state);
                returnVal.push(' current-state');
                if (recordData.Blocked) {
                    returnVal.push('" style="width:' + blockWidth*2 + '%">');
                    returnVal.push('<div class="hexagon"></div>');
                    returnVal.push('<div class="state-name">');
                    returnVal.push(symbolState + '</div></div>');
                } else {
                    returnVal.push('" style="width:' + blockWidth*2 + '%">&nbsp;' + symbolState + '&nbsp;</div>');
                }
            } else {
                returnVal.push(' clickable-state');
                returnVal.push('" style="width:' + blockWidth + '%">&nbsp;</div>');
            }

            //flip the switch so remaining states are gray
            if(state === currentState) {
                stateUsed = false;
            }
        }, this);

        if(this.showTrigger){
            returnVal.push('<div class="editor-trigger icon-chevron-down"></div>');
        }

        return returnVal.join('');
    },

    _isCreate: function (recordData) {
        return recordData.VersionId === "1" && recordData.modified && !recordData.modified.ScheduleState;
    },

    _getSymbolState: function(recordData, state) {
        var symbolState;
        if (recordData.ScheduleStatePrefix) {
            if (!recordData.isDirty || this._isCreate(recordData)) {
                symbolState = recordData.ScheduleStatePrefix;
            }  else {
                symbolState = '';
            }
        } else {
            symbolState = state === 'In-Progress' ? 'P' : state.charAt(0);
        }
        return symbolState;
    },

    _getClassFromState: function(blocked, ready){
        var className = '';
        if (blocked){
            className += ' blocked-state';
        } else if (ready) {
            className += ' ready-state';
        }

        return className;
    },

    getReferenceAttribute: function(data, field, attribute, defaultValue){
            if (!defaultValue){
                defaultValue = '';
            }
            return data[field] && data[field][attribute] || defaultValue;
        },
        createIdValue: function (data) {
            if (data.Recycled || this.renderIdAsText) {
                return this.createTextValue(data);
            } else {
                return this.createDetailLink(data);
            }
        },

        createTextValue: function (data) {
            return this.createIcon(data) + Ext.create('Rally.ui.renderer.template.StringTemplate', {
                    fieldName: 'FormattedID'
                }).apply(data);
        },

        createDetailLink: function (data) {
            var options = {
                record: data,
                text: this.createIcon(data) + (data.FormattedID || ''),
                showHover: !!this.showHover
            };
            var ref = Rally.util.Ref.getRelativeUri(data),
                type = Rally.util.Ref.getTypeFromRef(ref);

            if (type === 'testset') {
                if (ref) {
                    options.onclick = 'Rally.nav.Manager.edit(\'' + ref + '\'); return false;';
                }
            } else if(type === 'milestone') {
                var projectToNavigateTo = data.TargetProject || data.context.getProject();
                options.projectOid = Rally.util.Ref.getOidFromRef(projectToNavigateTo);
            }

            return Rally.nav.DetailLink.getLink(options);
        },

        createIcon: function (data) {
            if (this.showIcon === false) {
                return '';
            }

            var type = Rally.util.Ref.getTypeFromRef(data);
            var typeName = Rally.util.TypeInfo.normalizeTypeName(type);
            var typeInfo = Rally.util.TypeInfo.getTypeInfoByName(typeName);
            var className = typeInfo && typeInfo.icon;
            var colorAttr = typeName === 'milestone' && data.DisplayColor ? ' style="color: ' + data.DisplayColor + ';"' : '';

            return className ? '<span class="artifact-icon ' + className + '"' +  colorAttr + '></span>' : '';
        }

 });

 Ext.define('CArABU.technicalservices.PredecessorsStatusTemplate', {
        extend: 'Rally.ui.renderer.template.status.StatusTemplate',

        inheritableStatics: {
            onClick: function(event, ref) {
                Rally.ui.renderer.template.status.StatusTemplate.onClick(event, ref, {
                    field: 'PredecessorsAndSuccessors'
                });
            }
        },

        constructor: function(config) {
            this.callParent([
                '<tpl if="this._getDependenciesCount(values) &gt; 0">',
                '<a onclick="{[this._getOnClick(values)]}">',
                '<span class="predecessorsandsuccessors-cnt">{[this._getDependenciesCount(values)]}</span>',
                '</a>',
                '</tpl>'
            ]);

        },

        _getDependenciesCount: function (recordData) {
            return recordData.Predecessors.Count;
        },

        _getOnClick: function(recordData) {
            return 'Rally.ui.renderer.template.status.PredecessorsAndSuccessorsStatusTemplate.onClick(event, \'' + recordData._ref + '\'); return false;';
        }
    });
