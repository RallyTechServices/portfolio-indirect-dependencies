Ext.define("portfolio-indirect-dependencies", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    items: [
        {xtype:'container',itemId:'selector_box',layout: 'hbox'},
        {xtype:'container',itemId:'display_box'}
    ],

    integrationHeaders : {
        name : "portfolio-indirect-dependencies"
    },
                        
    launch: function() {
        this.initializeApp();
    },
    initializeApp: function(){
        this.initializeComponents();
    },
    initializeComponents: function(){
        this.getSelectorBox().removeAll();
        this.down('#display_box').removeAll();

        this.getSelectorBox().add({
           xtype: 'rallyartifactsearchcombobox',
            width: 500,
            fieldLabel: 'Portfolio Item',
            labelAlign: 'right',
            storeConfig: {
                models: ['portfolioitem/feature']
            },
            listeners: {
               select: this.updateView,
                scope: this
            }

        });
    },
    getSelectorBox: function(){
        return this.down('#selector_box');
    },
    updateView: function(cb){
        this.logger.log('updateView', cb.getValue());

        this.fetchDescendentsWithDependencies(this.getFeatureName(), cb.getValue()).then({
            success: this.fetchDependencies,
            failure: this.showErrorNotification,
            scope: this
        });
    },
    showErrorNotification: function(msg){
        Rally.ui.notify.Notifier.showError({message: msg});
    },
    getFeatureName: function(){
        return 'Feature';
    },
    fetchDescendentsWithDependencies: function(property, ref){
        this.logger.log('fetchDescendentsWithDependencies', property, ref);
        var fetch = ['FormattedID','Name','Predecessors','ObjectID','Iteration','EndDate','Project'];

        return this.fetchWsapiRecords({
            model: 'HierarchicalRequirement',
            fetch: fetch,
            context: {project: null},
            filters: [{
                property: property,
                value: ref
            },{
                property: 'Predecessors.ObjectID',
                operator: '>',
                value: 0
            }],
            limit: 'Infinity'
        });
    },
    fetchDependencies: function(records){
        this.logger.log('fetchDependencies', records);
        this.down('#display_box').removeAll();
        if (!records || records.length === 0){
            this.down('#display_box').add({
                xtype: 'container',
                html: '<div class="no-data-container"><div class="secondary-message">There are no story predecessors for the selected Portfolio Item.</div></div>'
            });
            return;
        }

        var dependencyHash = {},
            filters = [],
            rootObjectIDs = [];

        Ext.Array.each(records, function(r){
            var recordData = r.getData();
            dependencyHash[recordData.FormattedID] =recordData;
            dependencyHash[recordData.FormattedID]._dependencies = [];
            filters.push({
                property: 'Successors.ObjectID',
                value: recordData.ObjectID
            });
            rootObjectIDs.push(recordData.FormattedID);
        });

        this.dependencyHash = dependencyHash;
        this.rootStories = rootObjectIDs;

        filters = Rally.data.wsapi.Filter.or(filters);

        this.fetchWsapiRecords({
            model: 'HierarchicalRequirement',
            fetch: ['Predecessors','ObjectID','FormattedID','Name','Project','ScheduleState','Successors:summary[FormattedID]'],
            filters: filters
        }).then({
            success: this.updateDependencyGrid,
            failure: this.showErrorNotification,
            scope: this
        })

    },
    getSuccessorsFromSummary: function(summary){
        var summaryObjs = summary && summary.Successors && summary.Successors.FormattedID;
        if (!summaryObjs){
            return [];
        }
        var objIds = Ext.Object.getKeys(summaryObjs);
        this.logger.log('getSuccessorsFromSummary', summary,objIds);
        return objIds;

    },
    updateDependencyGrid: function(dependencies){
        this.logger.log('updateDependencyGrid', dependencies, this.dependencyHash);


        Ext.Array.each(dependencies, function(d){
            var obj = d.getData();
            obj._dependencies = [];
            this.dependencyHash[obj.FormattedID] = obj;

            var successors = this.getSuccessorsFromSummary(obj.Summary);
            Ext.Array.each(successors, function(s){
                if (this.dependencyHash[s]){
                    this.dependencyHash[s]._dependencies.push(obj);
                } else {
                    //Warning!
                }

            },this);
        }, this );

        this.logger.log('updateDependencyGrid', this.dependencyHash);


        var addDependencyColumns = function(rec, idx, row){
            row['col' + idx] = rec._dependencies || [];
            //row[idx] = rec._dependencies || [];
            Ext.Array.each(row[idx], function(r){
                row = addDependencyColumns(r, idx+1, row);
            });
            return row;
        }

        var data = [],
            maxCols = 0;
        Ext.Array.each(this.rootStories, function(oid){
            var row = {}, idx = 0;
            row.col0 = [this.dependencyHash[oid]];
            row = addDependencyColumns(this.dependencyHash[oid],1,row);
            data.push(row);
            maxCols = Math.max(Object.keys(row).length, maxCols);
        }, this );
        this.logger.log('data',data,maxCols);

        this.down('#display_box').add({
            xtype: 'rallygrid',
            columnCfgs: this.getColumnCfgs(maxCols),
            store: Ext.create('Rally.data.custom.Store',{
                data: data
            })
        });
    },
    getColumnCfgs: function(maxCols){
        var cols = [{
            xtype: 'templatecolumn',
            dataIndex: 'col0',
            text: 'Feature Story (Team)',
            flex: 1,
            tpl: '<tpl for=".">{values.FormattedID}</tpl>',
            renderer: function(v,m,r){
                var tpl = Ext.create('Ext.XTemplate', '<tpl for=".">',       // process the data.kids node
                    '<p>{FormattedID}:  {Name} ({Project.Name}) </p>',  // use current array index to autonumber
                    '</tpl>')
                return tpl.apply(v);
            }
        }];
        for (var i=1; i<maxCols; i++){
            cols.push({
                xtype: 'templatecolumn',
                dataIndex: 'col' + i,
                flex: 1,
                text: 'Predecessors Level ' + i + ' (Team)',
                tpl: '<tpl for=".">{FormattedID}</br></tpl>',
                renderer: function(v,m,r){
                    var tpl = Ext.create('Ext.XTemplate', '<tpl for=".">',       // process the data.kids node
                        '<p>{FormattedID}:  {Name} ({Project.Name})</p>',  // use current array index to autonumber
                        '</tpl>')
                    return tpl.apply(v);
                }
            });
        }
        return cols;

    },

    fetchWsapiRecords: function(config){
        var deferred = Ext.create('Deft.Deferred');
        this.logger.log('fetchWsapiRecords', config);
        Ext.create('Rally.data.wsapi.Store',config).load({
            callback: function(records, operation){
                this.logger.log('fetchWsapiRecords callback', records, operation);
                if (operation.wasSuccessful()){
                    deferred.resolve(records);
                } else {
                    deferred.reject('Error fetching records: ' + operation.error.errors.join(','));
                }
            },
            scope: this
        });

        return deferred;
    },
    getOptions: function() {
        return [
            {
                text: 'About...',
                handler: this._launchInfo,
                scope: this
            }
        ];
    },
    
    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{});
    },
    
    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    },
    
    //onSettingsUpdate:  Override
    onSettingsUpdate: function (settings){
        this.logger.log('onSettingsUpdate',settings);
        // Ext.apply(this, settings);
        this.launch();
    }
});
