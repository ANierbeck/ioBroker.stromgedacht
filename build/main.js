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
    try {
      const instObj = await this.getForeignObjectAsync(`system.adapter.${this.namespace}`);
      if (instObj && instObj.common && instObj.common.schedule && (instObj.common.schedule === "11 * * * *" || instObj.common.schedule === "*/15 * * * *")) {
        instObj.common.schedule = `${Math.floor(Math.random() * 60)} * * * *`;
        this.log.info(`Default schedule found and adjusted to spread calls better over the full hour!`);
        await this.setForeignObjectAsync(`system.adapter.${this.namespace}`, instObj);
        this.terminate ? this.terminate() : process.exit(0);
        return;
      }
    } catch (err) {
      this.log.error(`Could not check or adjust the schedule: ${err.message}`);
    }
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
    this.requestStates();
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
      hoursInFuture: 24
    };
    (0, import_axios.default)({
      method: "get",
      baseURL: "https://api.stromgedacht.de/v1/statesRelative",
      params: queryParams,
      timeout: 1e4,
      responseType: "json",
      validateStatus: (status) => status === 200
    }).then(async (response) => {
      this.log.info(`Received states for ${zipcode}: ${JSON.stringify(response.data)}`);
      this.setState("forecast.states.json", JSON.stringify(response.data), true);
      this.setState("forecast.states.hoursInFuture", hoursInFuture, true);
      this.parseState(response.data);
    }).catch((error) => {
      if (error.response) {
        this.log.error(`Error: ${error.response.status}`);
      } else if (error.request) {
        this.log.error(`Error: no data received for Current Weather data`);
      } else {
        this.log.error(`Error: ${error.message}`);
      }
      console.log(error.config);
    });
    this.setState("info.connection", true, true);
  }
  parseState(json) {
    this.log.info(`Parsing state ${JSON.stringify(json)}`);
    let states = [];
    states = json.states;
    this.log.debug(`States: ${JSON.stringify(states)}`);
    let stateId = "";
    states.forEach((state) => {
      switch (state.state) {
        case -1:
          stateId = "forecast.states.supergruen";
          this.log.info(`state ${stateId}`);
          break;
        case 1:
          stateId = "forecast.states.gruen";
          this.log.info(`state ${stateId}`);
          break;
        case 2:
          stateId = "forecast.states.gelb";
          this.log.info(`state ${stateId}`);
          break;
        case 3:
          stateId = "forecast.states.rot";
          this.log.info(`state ${stateId}`);
          break;
        default:
          break;
      }
      this.log.info(`Setting state ${stateId}.begin to ${state.from}`);
      this.setState(stateId + ".begin", state.from, true);
      this.log.info(`Setting state ${stateId}.end to ${state.to}`);
      this.setState(stateId + ".end", state.to, true);
    });
  }
}
if (require.main !== module) {
  module.exports = (options) => new Stromgedacht(options);
} else {
  (() => new Stromgedacht())();
}
//# sourceMappingURL=main.js.map
