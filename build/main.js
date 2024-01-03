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
var StateEnum = /* @__PURE__ */ ((StateEnum2) => {
  StateEnum2[StateEnum2["SUPERGRUEN"] = -1] = "SUPERGRUEN";
  StateEnum2[StateEnum2["GRUEN"] = 1] = "GRUEN";
  StateEnum2[StateEnum2["GELB"] = 2] = "GELB";
  StateEnum2[StateEnum2["ROT"] = 3] = "ROT";
  return StateEnum2;
})(StateEnum || {});
const stromgedachtApi = "https://api.stromgedacht.de/v1/statesRelative";
const statePaths = [
  "forecast.states.supergruen",
  "forecast.states.gruen",
  "forecast.states.gelb",
  "forecast.states.rot"
];
class Stromgedacht extends utils.Adapter {
  constructor(options = {}) {
    super({
      ...options,
      name: adapterName
    });
    this.on("ready", this.onReady.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  async onReady() {
    this.log.info(`config zipcode: ${this.config.zipcode}`);
    if (this.config.zipcode === void 0 || this.config.zipcode === "") {
      this.log.error("No zipcode configured");
      return;
    }
    this.log.debug(`removing stale states`);
    for (const path of statePaths) {
      this.log.debug(`Deleting states for ${path}`);
      await this.getChannelsOfAsync(path).then((channels) => {
        this.log.debug(`Channels to remove: ${JSON.stringify(channels)}`);
        for (const channel of channels) {
          this.log.debug(`ChannelID: ${channel._id}`);
          this.delObject(channel._id);
        }
      });
    }
    this.log.debug(`recreating states`);
    for (const obj of instanceObjects) {
      this.log.debug(`Creating object ${obj._id}`);
      await this.setObjectNotExistsAsync(obj._id, obj);
    }
    await this.requestStates().then(async (response) => {
      if (response === null) {
        this.log.error(`No response received`);
        return;
      }
      this.log.debug(`Received states for ${this.config.zipcode}: ${JSON.stringify(response.data)}`);
      this.setStateAsync("forecast.states.json", JSON.stringify(response.data), true);
      this.setStateAsync("forecast.states.hoursInFuture", this.config.hoursInFuture, true);
      return response.data;
    }).then(async (data) => this.parseState(data)).catch((error) => {
      this.log.error(`Error: ${error.message}`);
      this.setState("info.connection", false, true);
    });
    this.setState("info.connection", true, true);
    return;
  }
  onUnload(callback) {
    try {
      this.setState("info.connection", false, true);
      this.log.info("cleaned everything up...");
      callback();
    } catch (e) {
      callback();
    }
  }
  async requestStates() {
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
        this.log.error(`Error: no data received for time frame`);
      } else {
        this.log.error(`Error: ${error.message}`);
      }
      console.log(error.config);
      throw error;
    });
  }
  async parseState(json) {
    this.log.debug(`Parsing state ${JSON.stringify(json)}`);
    const states = json.states;
    this.log.debug(`States: ${JSON.stringify(states)}`);
    const supergruenStates = [];
    const supergruenTimeseries = [];
    const gruenStates = [];
    const gruenTimeseries = [];
    const gelbStates = [];
    const gelbTimeseries = [];
    const rotStates = [];
    const rotTimeseries = [];
    const timeseries = [];
    states.forEach((state) => {
      const timeDifference = this.getTimeOffset(new Date(state.from), new Date(state.to));
      const offSet = this.getOffset(new Date(state.from));
      switch (state.state) {
        case -1 /* SUPERGRUEN */:
          supergruenStates.push(state);
          for (let i = 0; i < timeDifference; i++) {
            const newTime = (state.from = new Date(state.from)).getTime() + i * 60 * 60 * 1e3 - offSet;
            const timeslot = new Date(newTime);
            supergruenTimeseries.push([timeslot, 1]);
          }
          break;
        case 1 /* GRUEN */:
          gruenStates.push(state);
          for (let i = 0; i < timeDifference; i++) {
            const newTime = (state.from = new Date(state.from)).getTime() + i * 60 * 60 * 1e3 - offSet;
            const timeslot = new Date(newTime);
            gruenTimeseries.push([timeslot, 1]);
          }
          break;
        case 2 /* GELB */:
          gelbStates.push(state);
          for (let i = 0; i < timeDifference; i++) {
            const newTime = (state.from = new Date(state.from)).getTime() + i * 60 * 60 * 1e3 - offSet;
            const timeslot = new Date(newTime);
            gelbTimeseries.push([timeslot, 1]);
          }
          break;
        case 3 /* ROT */:
          rotStates.push(state);
          for (let i = 0; i < timeDifference; i++) {
            const newTime = (state.from = new Date(state.from)).getTime() + i * 60 * 60 * 1e3 - offSet;
            const timeslot = new Date(newTime);
            rotTimeseries.push([timeslot, 1]);
          }
          break;
        default:
          break;
      }
      for (let i = 0; i < timeDifference; i++) {
        const newTime = (state.from = new Date(state.from)).getTime() + i * 60 * 60 * 1e3 - offSet;
        const timeslot = new Date(newTime);
        const timeslotState = state.state;
        timeseries.push([timeslot, timeslotState]);
      }
    });
    this.log.debug(`Timeseries: ${JSON.stringify(timeseries)}`);
    this.setStateAsync("forecast.states.timeseries", JSON.stringify(timeseries), true);
    this.setStates(supergruenStates, "forecast.states.supergruen", supergruenTimeseries);
    this.setStates(gruenStates, "forecast.states.gruen", gruenTimeseries);
    this.setStates(gelbStates, "forecast.states.gelb", gelbTimeseries);
    this.setStates(rotStates, "forecast.states.rot", rotTimeseries);
    this.setStateAsync("forecast.states.lastUpdated", new Date().toString(), true);
  }
  async setStates(states, stateIdPrefix, timeseries) {
    for (let i = 0; i < states.length; i++) {
      const stateId = `${stateIdPrefix}.${i}`;
      this.log.debug(`state ${stateId}`);
      await this.setObjectNotExists(`${stateId}.begin`, {
        type: "state",
        common: {
          name: `Begin of ${stateIdPrefix}`,
          type: "string",
          role: "time",
          read: true,
          write: false
        },
        native: {}
      });
      await this.setObjectNotExists(`${stateId}.end`, {
        type: "state",
        common: {
          name: `End of ${stateIdPrefix}`,
          type: "string",
          role: "time",
          read: true,
          write: false
        },
        native: {}
      });
      const state = states[i];
      this.log.debug(`Setting state ${stateId} to ${JSON.stringify(state)}`);
      this.setState(`${stateId}.begin`, state.from.toString(), true);
      this.setState(`${stateId}.end`, state.to.toString(), true);
    }
    this.setStateAsync(`${stateIdPrefix}.timeseries`, JSON.stringify(timeseries), true);
  }
  getOffset(from) {
    const offSetMinutes = from.getMinutes();
    const offSetSeconds = from.getSeconds();
    const offSetMilliseconds = from.getMilliseconds();
    const offSet = offSetMinutes * 60 * 1e3 + offSetSeconds * 1e3 + offSetMilliseconds;
    return offSet;
  }
  getTimeOffset(startDate, endDate) {
    const timeDifference = endDate.getTime() - startDate.getTime();
    const hoursOffset = timeDifference / (1e3 * 60 * 60);
    return hoursOffset;
  }
}
if (require.main !== module) {
  module.exports = (options) => new Stromgedacht(options);
} else {
  (() => new Stromgedacht())();
}
//# sourceMappingURL=main.js.map
