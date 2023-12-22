"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var utils = __toESM(require("@iobroker/adapter-core"));
var import_axios = __toESM(require("axios"));
const adapterName = require("./../package.json").name.split(".").pop();
const instanceObjects = require("./../io-package.json").instanceObjects;
const stromgedachtApi = "https://api.stromgedacht.de/v1/statesRelative";
class Stromgedacht extends utils.Adapter {
  constructor(options = {}) {
    super({
      ...options,
      name: adapterName
    });
    this.setState("info.connection", false, true);
    this.on("ready", this.onReady.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  async onReady() {
    for (const obj of instanceObjects) {
      await this.setObjectNotExistsAsync(obj._id, obj);
    }
    this.log.info(`config zipcode: ${this.config.zipcode}`);
    this.setState("info.connection", false, true);
    if (this.config.zipcode === void 0 || this.config.zipcode === "") {
      this.log.error("No zipcode configured");
      return;
    }
    this.getStatesOf("states", "", async (err, states) => {
      if (err) {
        this.log.error(`Could not get states of states: ${err.message}`);
        return;
      }
      for (const state of states) {
        this.log.info(`Deleting state ${state._id}`);
        await this.delObjectAsync(state._id);
      }
    });
    this.requestStates().then(async (response) => {
      if (response === null) {
        this.log.error(`No response received`);
        return;
      }
      this.log.info(`Received states for ${this.config.zipcode}: ${JSON.stringify(response.data)}`);
      this.setState("forecast.states.json", JSON.stringify(response.data), true);
      this.setState("forecast.states.hoursInFuture", this.config.hoursInFuture, true);
      this.setState("info.connection", true, true);
      return response.data;
    }).then((data) => this.parseState(data)).catch((error) => {
      this.log.error(`Error: ${error.message}`);
      this.setState("info.connection", true, true);
    });
  }
  onUnload(callback) {
    try {
      callback();
    } catch (e) {
      callback();
    }
  }
  requestStates() {
    const zipcode = this.config.zipcode;
    const hoursInFuture = this.config.hoursInFuture;
    const queryParams = {
      zip: zipcode,
      hoursInFuture
    };
    return (0, import_axios.default)({
      method: "get",
      baseURL: stromgedachtApi,
      params: queryParams,
      timeout: 1e4,
      responseType: "json",
      validateStatus: (status) => status === 200
    }).then((response) => {
      return response;
    }).catch((error) => {
      if (error.response) {
        this.log.error(`Error: ${error.response.status}`);
      } else if (error.request) {
        this.log.error(`Error: no data received for Current Weather data`);
      } else {
        this.log.error(`Error: ${error.message}`);
      }
      console.log(error.config);
      throw error;
    });
  }
  parseState(json) {
    this.log.info(`Parsing state ${JSON.stringify(json)}`);
    const states = json.states;
    this.log.debug(`States: ${JSON.stringify(states)}`);
    let stateId = "";
    const supergruenStates = [];
    const gruenStates = [];
    const gelbStates = [];
    const rotStates = [];
    states.forEach((state) => {
      switch (state.state) {
        case -1:
          this.log.info(`state ${stateId}`);
          supergruenStates.push(state);
          break;
        case 1:
          this.log.info(`state ${stateId}`);
          gruenStates.push(state);
          break;
        case 2:
          this.log.info(`state ${stateId}`);
          gelbStates.push(state);
          break;
        case 3:
          this.log.info(`state ${stateId}`);
          rotStates.push(state);
          break;
        default:
          break;
      }
    });
    for (let i = 0; i < supergruenStates.length; i++) {
      stateId = `forecast.states.supergruen.${i}`;
      this.setObjectNotExists(`${stateId}.begin`, {
        type: "state",
        common: {
          name: "Begin of supergruen",
          type: "string",
          role: "time",
          read: true,
          write: false
        },
        native: {}
      });
      this.setObjectNotExists(`${stateId}.end`, {
        type: "state",
        common: {
          name: "End of supergruen",
          type: "string",
          role: "time",
          read: true,
          write: false
        },
        native: {}
      });
      const state = supergruenStates[i];
      this.log.info(`Setting state ${stateId} to ${JSON.stringify(state)}`);
      this.setState(`${stateId}.begin`, state.from, true);
      this.setState(`${stateId}.end`, state.to, true);
    }
    for (let i = 0; i < gruenStates.length; i++) {
      stateId = `forecast.states.gruen.${i}`;
      this.setObjectNotExists(`${stateId}.begin`, {
        type: "state",
        common: {
          name: "Begin of gruen",
          type: "string",
          role: "time",
          read: true,
          write: false
        },
        native: {}
      });
      this.setObjectNotExists(`${stateId}.end`, {
        type: "state",
        common: {
          name: "End of gruen",
          type: "string",
          role: "time",
          read: true,
          write: false
        },
        native: {}
      });
      const state = gruenStates[i];
      this.log.info(`Setting state ${stateId} to ${JSON.stringify(state)}`);
      this.setState(`${stateId}.begin`, state.from, true);
      this.setState(`${stateId}.end`, state.to, true);
    }
    for (let i = 0; i < gelbStates.length; i++) {
      stateId = `forecast.states.gelb.${i}`;
      this.setObjectNotExists(`${stateId}.begin`, {
        type: "state",
        common: {
          name: "Begin of gelb",
          type: "string",
          role: "time",
          read: true,
          write: false
        },
        native: {}
      });
      this.setObjectNotExists(`${stateId}.end`, {
        type: "state",
        common: {
          name: "End of gelb",
          type: "string",
          role: "time",
          read: true,
          write: false
        },
        native: {}
      });
      const state = gelbStates[i];
      this.log.info(`Setting state ${stateId} to ${JSON.stringify(state)}`);
      this.setState(`${stateId}.begin`, state.from, true);
      this.setState(`${stateId}.end`, state.to, true);
    }
    for (let i = 0; i < rotStates.length; i++) {
      stateId = `forecast.states.rot.${i}`;
      this.setObjectNotExists(`${stateId}.begin`, {
        type: "state",
        common: {
          name: "Begin of rot",
          type: "string",
          role: "time",
          read: true,
          write: false
        },
        native: {}
      });
      this.setObjectNotExists(`${stateId}.end`, {
        type: "state",
        common: {
          name: "End of rot",
          type: "string",
          role: "time",
          read: true,
          write: false
        },
        native: {}
      });
      const state = rotStates[i];
      this.log.info(`Setting state ${stateId} to ${JSON.stringify(state)}`);
      this.setState(`${stateId}.begin`, state.from, true);
      this.setState(`${stateId}.end`, state.to, true);
    }
  }
}
if (require.main !== module) {
  module.exports = (options) => new Stromgedacht(options);
} else {
  (() => new Stromgedacht())();
}
//# sourceMappingURL=main.js.map
