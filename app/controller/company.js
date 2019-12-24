'use strict';

const Controller = require('egg').Controller;

class CompanyController extends Controller {
  async find() {
    const { ctx, service } = this;
    ctx.body = await service.company.findAll();
  }

  async findById() {
    const { ctx, service } = this;
    ctx.body = await service.company.findById(ctx.params.id);
  }

  async edit() {
    const { ctx, service } = this;

    ctx.body = await service.company.updateById(ctx.request.body);
  }

  async self() {
    //
    const { ctx, service } = this;

    ctx.body = await service.company.findByUser(ctx.session.user.id);
  }
}

module.exports = CompanyController;
