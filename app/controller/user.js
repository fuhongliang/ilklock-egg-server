'use strict';

const Controller = require('egg').Controller;

class UserController extends Controller {
  async importUser() {
    const { ctx } = this;

    await this.service.user.importUser([{
      mobile: '18825110996',
      realname: 'xxx',
    }, {
      mobile: '18825110997',
      realname: 'xxx',
    }, {
      mobile: '18825110998',
      realname: 'xxx',
    }]);

    ctx.body = {};
  }


  async sendSMSVerifyCode() {
    const { ctx } = this;

    ctx.body = await this.service.login.sendMobileVerifyCode(ctx.request.body.mobile);
  }

  async bindMobileByWxid() {
    const { ctx } = this;

    ctx.body = await this.service.user.bindMobileByWxid(ctx.request.body.mobile, ctx.request.body.code);
  }

  async search() {
    const { ctx } = this;

    const name = ctx.query.name;
    const mobile = ctx.query.mobile;

    ctx.body = await this.service.user.search(name, mobile);
  }

}

module.exports = UserController;
