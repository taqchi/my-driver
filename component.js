/* v----- Do not change anything between here
 *       (the DRIVERNAME placeholder will be automatically replaced during build) */
define('ui/components/machine/driver-cloudca/component', ['exports', 'ember', 'ui/mixins/driver'], function (exports, _ember, _uiMixinsDriver) {

  exports['default'] = _ember['default'].Component.extend(_uiMixinsDriver['default'], {
    driverName: 'cloudca',
/* ^--- And here */

    // Write your component here, starting with setting 'model' to a machine with your config populated
    bootstrap: function () {
      let config = this.get('store').createRecord({
        type: 'cloudcaConfig',
      });

      let type = 'host';
      if (!this.get('useHost')) {
        type = 'machine';
      }

      this.set('model', this.get('store').createRecord({
        type: type,
        'cloudcaConfig': config,
      }));
    },

    // Add custom validation beyond what can be done from the config API schema
    validate: function () {
      this._super();
      var errors = this.get('errors') || [];

      var name = this.get('model.hostname');
      if (name) {
        if (name.length > 62) {
          // Max is actually 63, but host naming goes alllll the way to 11, so we'll play it safe.
          errors.push('Name can be a maximum of 62 characters long.');
        } else if (!/^[a-zA-Z]/.test(name) || !/[a-zA-Z0-9]$/.test(name)) {
          errors.push('Name must start with a letter and end with a letter or digit.');
        } else if (!/^[-a-zA-Z0-9]+$/.test(name)) {
          errors.push('Name can only contain letters, digits and hyphens.');
        }
      }

      this.set('errors', errors);
      return !errors.length;
    },

    firstPage: true,
    environmentsById: {},
    actions: {
      nextPage: function () {
        this.set('errors', []);
        this.apiCall('/environments', function (environments) {
          if (environments.errors) {
            this.set('errors', environments.errors.map(function (err) {
              return err.message;
            }));
            return;
          }

          var envs = environments.data.filter(function (env) {
            return env.serviceConnection.type.toLowerCase() === 'cloudca';
          });

          this.environmentsById = envs.reduce(function (m, e) {
            m[e.id] = e;
            return m;
          }, {});

          this.set('environmentOptions', envs
            .map(function (env) {
              return {
                name: env.name,
                value: env.id,
                group: env.serviceConnection.serviceCode
              };
            }));
          if (this.get('environmentOptions').length > 0) {
             this.set('model.cloudcaConfig.environmentId', this.get('environmentOptions')[0].value);
          }
          this.set('firstPage', false);
        }.bind(this));
      }
    },

    environmentChange: function () {
      var env = this.environmentsById[this.get('model.cloudcaConfig.environmentId')];
      if (env) {
        this.set('model.cloudcaConfig.environmentName', env.name);
        this.set('model.cloudcaConfig.serviceCode', env.serviceConnection.serviceCode);

        this.updateNetworksOnEnvironmentChange();
        this.updateTemplatesOnEnvironmentChange();
      }
    }.observes('model.cloudcaConfig.environmentId'),

    updateNetworksOnEnvironmentChange: function () {
      this.apiCall(this.getServicesApiEndpoint('networks'), function (listNetworksResponse) {
        if (listNetworksResponse.errors) {
          this.set('errors', listNetworksResponse.errors.map(function (err) {
            return err.message;
          }));
          return;
        }
        var networks = listNetworksResponse.data;
        this.set('networkOptions', networks.map(function (network) {
            return {
               name: network.name,
               value: network.id,
               group: network.vpcName
            };
         }));
         if (this.get('networkOptions').length > 0) {
           this.set('model.cloudcaConfig.networkId', this.get('networkOptions')[0].value);
         }
      }.bind(this));
    },

    updateComputeOfferingsOnServiceCodeChange: function () {
      this.apiCall(this.getServicesApiEndpoint('computeofferings'), function (listComputeOfferingsResponse) {
        if (listComputeOfferingsResponse.errors) {
          this.set('errors', listComputeOfferingsResponse.errors.map(function (err) {
            return err.message;
          }));
          return;
        }
        var offerings = listComputeOfferingsResponse.data;
        this.set('computeOfferingOptions', offerings.map(function (offering) {
            return {
               name: offering.name,
               value: offering.id
            };
         }));
         if (this.get('computeOfferingOptions').length > 0) {
           this.set('model.cloudcaConfig.computeOffering', this.get('computeOfferingOptions')[0].value);
         }
      }.bind(this));
   }.observes('model.cloudcaConfig.serviceCode'),

    updateDiskOfferingsOnServiceCodeChange: function () {
      this.apiCall(this.getServicesApiEndpoint('diskofferings'), function (listDiskOfferingsResponse) {
        if (listDiskOfferingsResponse.errors) {
          this.set('errors', listDiskOfferingsResponse.errors.map(function (err) {
            return err.message;
          }));
          return;
        }
        var offeringOptions = listDiskOfferingsResponse.data.map(function (offering) {
            return {
               name: offering.name,
               value: offering.id
            };
         });
         offeringOptions.push({name:"No additional disk", value:""})
         this.set('diskOfferingOptions', offeringOptions);
         this.set('model.cloudcaConfig.diskOffering', this.get('diskOfferingOptions')[0].value);
      }.bind(this));
    }.observes('model.cloudcaConfig.serviceCode'),

    updateTemplatesOnEnvironmentChange: function () {
      this.apiCall(this.getServicesApiEndpoint('templates'), function (listTemplatesResponse) {
        if (listTemplatesResponse.errors) {
          this.set('errors', listTemplatesResponse.errors.map(function (err) {
            return err.message;
          }));
          return;
        }
        var removeTemplateRegex = /windows|centos 6/i;
        var templates = listTemplatesResponse.data.filter(function(template) {
           return !template.name.match(removeTemplateRegex);
        });

        this.set('templateOptions', templates.map(function (template) {
            return {
               name: template.name,
               value: template.id,
               group: template.isPublic ? 'Standard':'User defined',
               resizable: template.resizable,
               maxSizeInGb: template.maxSizeInGb,
               stepSizeInGb: template.stepSizeInGb
            };
         }).sortBy('group','name'));

         this.set('defaultUsernamesByTemplate', templates.reduce(function (m, t) {
           m[t.id] = t.defaultUsername;
           return m;
         }, {}));

         if (this.get('templateOptions').length > 0) {
           this.set('model.cloudcaConfig.template', this.get('templateOptions')[0].value);
         }
      }.bind(this));
    },

    updateSSHUserOnTemplateChange: function () {
      var defaultUsername = this.get('defaultUsernamesByTemplate')[this.get('model.cloudcaConfig.template')];
      if (defaultUsername) {
         this.set('model.cloudcaConfig.sshUser', defaultUsername);
      }
   }.observes('model.cloudcaConfig.template'),

   updateResizableOnTemplateChange: function() {
      var templateOptions = this.get('templateOptions');
      var selectedTemplateId = this.get("model.cloudcaConfig.template");
      var selectedTemplate = templateOptions.findBy('value', selectedTemplateId) || templateOptions[0];
      this.set('templateResizable', selectedTemplate.resizable);
      this.set('maxSizeInGb', selectedTemplate.maxSizeInGb);
      this.set('stepSizeInGb', selectedTemplate.stepSizeInGb);
      var templateSizeInGb = selectedTemplate.size / Math.pow(1024, 3);
      var stepSize = selectedTemplate.stepSizeInGb,
          aligned = templateSizeInGb % stepSize === 0,
          minSizeInGb = stepSize * (Math.floor(templateSizeInGb / stepSize) + (aligned ? 0 : 1));
      this.set('minSizeInGb', minSizeInGb);
      var currentSize = this.get('model.cloudcaConfig.rootDiskSizeInGb');
      if(currentSize < minSizeInGb) {
        this.set('model.cloudcaConfig.rootDiskSizeInGb', minSizeInGb);
      }
      this.rerender();
   }.observes('model.cloudcaConfig.template'),

   apiCall: function (endpoint, callback) {
      var url = this.get('model.cloudcaConfig.apiUrl') + endpoint,
          xhr = new XMLHttpRequest();
      xhr.addEventListener('load', function () {
        callback(JSON.parse(this.responseText));
      });
      xhr.open('get', url, true);
      xhr.setRequestHeader('MC-Api-Key', this.get('model.cloudcaConfig.apiKey'));
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send();
   },

   getServicesApiEndpoint: function(entity) {
         return '/services/' + this.get('model.cloudcaConfig.serviceCode') + '/' +  this.get('model.cloudcaConfig.environmentName') + '/' + entity;
   }
  });
});
;
define("ui/components/machine/driver-cloudca/template",["exports","ember","ui/mixins/driver"],function(exports,_ember,_uiMixinsDriver){

exports["default"] = Ember.HTMLBars.template((function() {
  var child0 = (function() {
    return {
      meta: {
        "revision": "Ember@2.9.1",
        "loc": {
          "source": null,
          "start": {
            "line": 2,
            "column": 2
          },
          "end": {
            "line": 20,
            "column": 2
          }
        }
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("    ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","over-hr r-mb20");
        var el2 = dom.createTextNode("\n      ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("span");
        var el3 = dom.createTextNode("credentials");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n    ");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n\n    ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","row");
        var el2 = dom.createTextNode("\n      ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","col-sm-12 col-md-2 form-label");
        var el3 = dom.createTextNode("\n        ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("label");
        dom.setAttribute(el3,"class","form-control-static");
        var el4 = dom.createTextNode("API Key*");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n      ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n      ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","col-sm-12 col-md-10");
        var el3 = dom.createTextNode("\n        ");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n      ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n    ");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n\n    ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","footer-actions");
        var el2 = dom.createTextNode("\n      ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("button");
        dom.setAttribute(el2,"class","btn btn-primary");
        var el3 = dom.createTextNode("Next: Configure instance");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n      ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("button");
        dom.setAttribute(el2,"class","btn btn-link");
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n    ");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element4 = dom.childAt(fragment, [5]);
        var element5 = dom.childAt(element4, [1]);
        var element6 = dom.childAt(element4, [3]);
        var morphs = new Array(5);
        morphs[0] = dom.createMorphAt(dom.childAt(fragment, [3, 3]),1,1);
        morphs[1] = dom.createAttrMorph(element5, 'disabled');
        morphs[2] = dom.createElementMorph(element5);
        morphs[3] = dom.createElementMorph(element6);
        morphs[4] = dom.createMorphAt(element6,0,0);
        return morphs;
      },
      statements: [
        ["inline","input",[],["type","password","class","form-control","value",["subexpr","@mut",[["get","model.cloudcaConfig.apiKey",["loc",[null,[12,60],[12,86]]],0,0,0,0]],[],[],0,0],"placeholder","Your cloud.ca API Key"],["loc",[null,[12,8],[12,124]]],0,0],
        ["attribute","disabled",["subexpr","not",[["get","model.cloudcaConfig.apiKey",["loc",[null,[17,77],[17,103]]],0,0,0,0]],[],["loc",[null,[null,null],[17,105]]],0,0],0,0,0,0],
        ["element","action",["nextPage"],[],["loc",[null,[17,14],[17,37]]],0,0],
        ["element","action",["cancel"],[],["loc",[null,[18,14],[18,35]]],0,0],
        ["inline","t",["generic.cancel"],[],["loc",[null,[18,57],[18,81]]],0,0]
      ],
      locals: [],
      templates: []
    };
  }());
  var child1 = (function() {
    var child0 = (function() {
      return {
        meta: {
          "revision": "Ember@2.9.1",
          "loc": {
            "source": null,
            "start": {
              "line": 126,
              "column": 4
            },
            "end": {
              "line": 140,
              "column": 4
            }
          }
        },
        isEmpty: false,
        arity: 0,
        cachedFragment: null,
        hasRendered: false,
        buildFragment: function buildFragment(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("      ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1,"class","row form-group");
          var el2 = dom.createTextNode("\n        ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("div");
          dom.setAttribute(el2,"class","col-sm-12 col-md-2 form-label");
          var el3 = dom.createTextNode("\n          ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("label");
          dom.setAttribute(el3,"class","form-control-static");
          var el4 = dom.createTextNode("Root Disk Size (optional)");
          dom.appendChild(el3, el4);
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n        ");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n        ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("div");
          dom.setAttribute(el2,"class","col-sm-12 col-md-10 root-disk-slider");
          var el3 = dom.createTextNode("\n          ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("div");
          dom.setAttribute(el3,"class","col-sm-2 col-md-1");
          var el4 = dom.createTextNode("\n            ");
          dom.appendChild(el3, el4);
          var el4 = dom.createComment("");
          dom.appendChild(el3, el4);
          var el4 = dom.createTextNode("\n          ");
          dom.appendChild(el3, el4);
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n          ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("div");
          dom.setAttribute(el3,"class","col-sm-10 col-md-8");
          var el4 = dom.createTextNode("\n            ");
          dom.appendChild(el3, el4);
          var el4 = dom.createComment("");
          dom.appendChild(el3, el4);
          var el4 = dom.createTextNode("\n          ");
          dom.appendChild(el3, el4);
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n        ");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n      ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
          var element0 = dom.childAt(fragment, [1, 3]);
          var morphs = new Array(2);
          morphs[0] = dom.createMorphAt(dom.childAt(element0, [1]),1,1);
          morphs[1] = dom.createMorphAt(dom.childAt(element0, [3]),1,1);
          return morphs;
        },
        statements: [
          ["content","model.cloudcaConfig.rootDiskSizeInGb",["loc",[null,[133,12],[133,52]]],0,0,0,0],
          ["inline","input-slider",[],["value",["subexpr","@mut",[["get","model.cloudcaConfig.rootDiskSizeInGb",["loc",[null,[136,33],[136,69]]],0,0,0,0]],[],[],0,0],"valueMin",["subexpr","@mut",[["get","minSizeInGb",["loc",[null,[136,79],[136,90]]],0,0,0,0]],[],[],0,0],"valueMax",["subexpr","@mut",[["get","maxSizeInGb",["loc",[null,[136,100],[136,111]]],0,0,0,0]],[],[],0,0],"step",["subexpr","@mut",[["get","stepSizeInGb",["loc",[null,[136,117],[136,129]]],0,0,0,0]],[],[],0,0]],["loc",[null,[136,12],[136,131]]],0,0]
        ],
        locals: [],
        templates: []
      };
    }());
    return {
      meta: {
        "revision": "Ember@2.9.1",
        "loc": {
          "source": null,
          "start": {
            "line": 20,
            "column": 2
          },
          "end": {
            "line": 180,
            "column": 2
          }
        }
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("    ");
        dom.appendChild(el0, el1);
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n\n    ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","over-hr r-mt20 r-mb20");
        var el2 = dom.createTextNode("\n      ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("span");
        var el3 = dom.createTextNode("deployment");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n    ");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n\n    ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","row form-group");
        var el2 = dom.createTextNode("\n      ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","col-sm-12 col-md-2 form-label");
        var el3 = dom.createTextNode("\n        ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("label");
        dom.setAttribute(el3,"class","form-control-static");
        var el4 = dom.createTextNode("Environment");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n      ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n      ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","col-sm-12 col-md-3");
        var el3 = dom.createTextNode("\n        ");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n      ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n      ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","col-sm-12 col-md-2 col-md-offset-1 form-label");
        var el3 = dom.createTextNode("\n        ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("label");
        dom.setAttribute(el3,"class","form-control-static");
        var el4 = dom.createTextNode("Network");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n      ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n      ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","col-sm-12 col-md-3");
        var el3 = dom.createTextNode("\n      ");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n      ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n    ");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n\n    ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","over-hr r-mt20 r-mb20");
        var el2 = dom.createTextNode("\n      ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("span");
        var el3 = dom.createTextNode("instance");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n    ");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n\n    ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","row form-group");
        var el2 = dom.createTextNode("\n      ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","col-sm-12 col-md-2 form-label");
        var el3 = dom.createTextNode("\n        ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("label");
        dom.setAttribute(el3,"class","form-control-static");
        var el4 = dom.createTextNode("Template");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n      ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n      ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","col-sm-12 col-md-3");
        var el3 = dom.createTextNode("\n        ");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n      ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n      ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","col-sm-12 col-md-2 col-md-offset-1 form-label");
        var el3 = dom.createTextNode("\n        ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("label");
        dom.setAttribute(el3,"class","form-control-static");
        var el4 = dom.createTextNode("SSH User");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n      ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n      ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","col-sm-12 col-md-3");
        var el3 = dom.createTextNode("\n        ");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n      ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n    ");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n\n    ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","row form-group");
        var el2 = dom.createTextNode("\n      ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","col-sm-12 col-md-2 form-label");
        var el3 = dom.createTextNode("\n        ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("label");
        dom.setAttribute(el3,"class","form-control-static");
        var el4 = dom.createTextNode("Compute Offering");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n      ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n      ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","col-sm-12 col-md-3");
        var el3 = dom.createTextNode("\n         ");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n      ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n      ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","col-sm-12 col-md-2 col-md-offset-1 form-label");
        var el3 = dom.createTextNode("\n        ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("label");
        dom.setAttribute(el3,"class","form-control-static");
        var el4 = dom.createTextNode("Use Private IP");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n      ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n      ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","col-sm-12 col-md-3 form-control-static");
        var el3 = dom.createTextNode("\n        ");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n      ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("\n      <div class=\"col-sm-12 col-md-1 form-label\">\n        <label class=\"form-control-static\">vCPUs</label>\n      </div>\n      <div class=\"col-sm-12 col-md-3\">\n        {{ input type=\"text\" class=\"form-control\" value=model.cloudcaConfig.cpuCount }}\n      </div>\n\n      <div class=\"col-sm-12 col-md-1 form-label\">\n        <label class=\"form-control-static\">RAM</label>\n      </div>\n      <div class=\"col-sm-12 col-md-3\">\n        <div class=\"input-group\">\n          {{ input type=\"text\" class=\"form-control\" value=model.cloudcaConfig.memoryMb }}\n          <span class=\"input-group-addon\">MB</span>\n        </div>\n      </div>\n   ");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n    ");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n\n    ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","over-hr r-mt20 r-mb20");
        var el2 = dom.createTextNode("\n      ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("span");
        var el3 = dom.createTextNode("storage");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n    ");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("    ");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","row form-group");
        var el2 = dom.createTextNode("\n      ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","col-sm-12 col-md-2 col-md-1 form-label");
        var el3 = dom.createTextNode("\n        ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("label");
        dom.setAttribute(el3,"class","form-control-static");
        var el4 = dom.createTextNode("Additional Disk (optional)");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n      ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n      ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","col-sm-12 col-md-3");
        var el3 = dom.createTextNode("\n         ");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n      ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n   ");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("\n      <div class=\"col-sm-12 col-md-1 form-label\">\n        <label class=\"form-control-static\">Size</label>\n      </div>\n\n      <div class=\"col-sm-12 col-md-3\">\n        <div class=\"input-group\">\n          {{ input type=\"text\" class=\"form-control\" value=model.cloudcaConfig.additionalDiskSizeGb }}\n          <span class=\"input-group-addon\">GB</span>\n        </div>\n      </div>\n\n      <div class=\"col-sm-12 col-md-1 form-label\">\n        <label class=\"form-control-static\">Performance</label>\n      </div>\n      <div class=\"col-sm-12 col-md-3\">\n        <div class=\"input-group\">\n          {{ input type=\"text\" class=\"form-control\" value=model.cloudcaConfig.additionalDiskIops }}\n          <span class=\"input-group-addon\">IOPS</span>\n        </div>\n      </div>\n");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n    ");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n\n    ");
        dom.appendChild(el0, el1);
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n    ");
        dom.appendChild(el0, el1);
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element1 = dom.childAt(fragment, [5]);
        var element2 = dom.childAt(fragment, [9]);
        var element3 = dom.childAt(fragment, [11]);
        var morphs = new Array(11);
        morphs[0] = dom.createMorphAt(fragment,1,1,contextualElement);
        morphs[1] = dom.createMorphAt(dom.childAt(element1, [3]),1,1);
        morphs[2] = dom.createMorphAt(dom.childAt(element1, [7]),1,1);
        morphs[3] = dom.createMorphAt(dom.childAt(element2, [3]),1,1);
        morphs[4] = dom.createMorphAt(dom.childAt(element2, [7]),1,1);
        morphs[5] = dom.createMorphAt(dom.childAt(element3, [3]),1,1);
        morphs[6] = dom.createMorphAt(dom.childAt(element3, [7]),1,1);
        morphs[7] = dom.createMorphAt(fragment,15,15,contextualElement);
        morphs[8] = dom.createMorphAt(dom.childAt(fragment, [17, 3]),1,1);
        morphs[9] = dom.createMorphAt(fragment,19,19,contextualElement);
        morphs[10] = dom.createMorphAt(fragment,21,21,contextualElement);
        return morphs;
      },
      statements: [
        ["inline","partial",["host/add-common"],[],["loc",[null,[21,4],[21,35]]],0,0],
        ["inline","new-select",[],["class","form-control","content",["subexpr","@mut",[["get","environmentOptions",["loc",[null,[34,18],[34,36]]],0,0,0,0]],[],[],0,0],"optionLabelPath","name","optionValuePath","value","optionGroupPath","group","value",["subexpr","@mut",[["get","model.cloudcaConfig.environmentId",["loc",[null,[38,16],[38,49]]],0,0,0,0]],[],[],0,0]],["loc",[null,[32,8],[39,10]]],0,0],
        ["inline","new-select",[],["class","form-control","content",["subexpr","@mut",[["get","networkOptions",["loc",[null,[48,16],[48,30]]],0,0,0,0]],[],[],0,0],"optionLabelPath","name","optionValuePath","value","optionGroupPath","group","value",["subexpr","@mut",[["get","model.cloudcaConfig.networkId",["loc",[null,[52,14],[52,43]]],0,0,0,0]],[],[],0,0]],["loc",[null,[46,6],[53,8]]],0,0],
        ["inline","new-select",[],["class","form-control","content",["subexpr","@mut",[["get","templateOptions",["loc",[null,[68,18],[68,33]]],0,0,0,0]],[],[],0,0],"optionLabelPath","name","optionValuePath","value","optionGroupPath","group","value",["subexpr","@mut",[["get","model.cloudcaConfig.template",["loc",[null,[72,16],[72,44]]],0,0,0,0]],[],[],0,0]],["loc",[null,[66,8],[73,10]]],0,0],
        ["inline","input",[],["type","text","class","form-control","value",["subexpr","@mut",[["get","model.cloudcaConfig.sshUser",["loc",[null,[80,56],[80,83]]],0,0,0,0]],[],[],0,0]],["loc",[null,[80,8],[80,86]]],0,0],
        ["inline","new-select",[],["class","form-control","content",["subexpr","@mut",[["get","computeOfferingOptions",["loc",[null,[91,19],[91,41]]],0,0,0,0]],[],[],0,0],"optionLabelPath","name","optionValuePath","value","value",["subexpr","@mut",[["get","model.cloudcaConfig.computeOffering",["loc",[null,[94,17],[94,52]]],0,0,0,0]],[],[],0,0]],["loc",[null,[89,9],[95,11]]],0,0],
        ["inline","input",[],["type","checkbox","checked",["subexpr","@mut",[["get","model.cloudcaConfig.usePrivateIp",["loc",[null,[101,41],[101,73]]],0,0,0,0]],[],[],0,0]],["loc",[null,[101,8],[101,76]]],0,0],
        ["block","if",[["get","templateResizable",["loc",[null,[126,10],[126,27]]],0,0,0,0]],[],0,null,["loc",[null,[126,4],[140,11]]]],
        ["inline","new-select",[],["class","form-control","content",["subexpr","@mut",[["get","diskOfferingOptions",["loc",[null,[148,19],[148,38]]],0,0,0,0]],[],[],0,0],"optionLabelPath","name","optionValuePath","value","value",["subexpr","@mut",[["get","model.cloudcaConfig.additionalDiskOffering",["loc",[null,[151,17],[151,59]]],0,0,0,0]],[],[],0,0]],["loc",[null,[146,9],[152,11]]],0,0],
        ["inline","partial",["host/add-options"],[],["loc",[null,[178,4],[178,36]]],0,0],
        ["inline","save-cancel",[],["save","save","cancel","cancel"],["loc",[null,[179,4],[179,49]]],0,0]
      ],
      locals: [],
      templates: [child0]
    };
  }());
  return {
    meta: {
      "revision": "Ember@2.9.1",
      "loc": {
        "source": null,
        "start": {
          "line": 1,
          "column": 0
        },
        "end": {
          "line": 185,
          "column": 0
        }
      }
    },
    isEmpty: false,
    arity: 0,
    cachedFragment: null,
    hasRendered: false,
    buildFragment: function buildFragment(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createElement("section");
      dom.setAttribute(el1,"class","horizontal-form");
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      var el2 = dom.createComment("");
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      var el2 = dom.createComment("");
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      return el0;
    },
    buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
      var element7 = dom.childAt(fragment, [0]);
      var morphs = new Array(2);
      morphs[0] = dom.createMorphAt(element7,1,1);
      morphs[1] = dom.createMorphAt(element7,3,3);
      return morphs;
    },
    statements: [
      ["block","if",[["get","firstPage",["loc",[null,[2,8],[2,17]]],0,0,0,0]],[],0,1,["loc",[null,[2,2],[180,9]]]],
      ["inline","top-errors",[],["errors",["subexpr","@mut",[["get","errors",["loc",[null,[183,20],[183,26]]],0,0,0,0]],[],[],0,0]],["loc",[null,[183,0],[183,28]]],0,0]
    ],
    locals: [],
    templates: [child0, child1]
  };
}()));;

});
