'use strict';

const Controller = require('egg').Controller;

const startTime = Date.now();
class HomeController extends Controller {
  async index() {
    const { ctx } = this;
    ctx.body = {
      code: 0,
      data: {},
      msg: 'hi, egg',
    };
  }

  async uptime() {
    const { ctx } = this;
    const uptime = (Date.now() - startTime) / 1000;
    const upDays = Math.floor(uptime / 3600 / 24);
    const upHours = Math.floor((uptime % (3600 * 24)) / 3600);
    const upMinutes = Math.floor((uptime % (3600 * 24 * 60)) / 60);
    const upSeconds = Math.floor(uptime % 60);

    ctx.body = {
      code: 0,
      msg: `Server start at ${startTime}, uptime: ${upDays}d ${upHours}h ${upMinutes}min ${upSeconds}s`,
    };

  }
}

module.exports = HomeController;
