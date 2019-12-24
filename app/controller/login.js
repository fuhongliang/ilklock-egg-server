'use strict';

const Controller = require('egg').Controller;
const BizError = require('../model/error');

class LoginController extends Controller {
  async loginByMobile() {
    const { ctx } = this;

    const body = ctx.request.body;

    const mobile = body.mobile;
    const password = body.password;

    await this.service.login.loginByPwd(mobile, password);
    ctx.body = {};
  }

  async loginByWxid() {
    const { ctx } = this;

    //
    const body = ctx.request.body;

    const code = body.code;
    await this.service.login.loginByWxid(code);
    ctx.body = {};
  }

  async selectCompany() {
    const { ctx } = this;

    if (!ctx.session.user) throw new BizError('Not Login!', 401);

    const selectedCompany = parseInt(ctx.request.body.company, 10);
    if (!selectedCompany) throw new BizError('Please select your company.');

    const companys = await this.service.company.findByUser(ctx.session.user.id);
    const companyExists = companys.some(c => c.id === selectedCompany);
    if (!companyExists) throw new BizError('Company doesn\'t exist.');

    ctx.session.company = selectedCompany;
    ctx.body = {};
  }

  async resetCompany() {
    const { ctx } = this;

    if (!ctx.session.user) throw new BizError('Not Login!', 401);

    ctx.session.company = null;
    await this.service.user.findCompanyByUser(ctx.session.user.id);
    ctx.body = {};
  }
}

module.exports = LoginController;
