'use strict';

const Controller = require('egg').Controller;

class CompanyAreaController extends Controller {
  async tree() {
    const { ctx, service } = this;
    ctx.body = await service.companyArea.buildAreaTree();
  }

  async list() {
    const { ctx, service } = this;
    ctx.body = await service.companyArea.findByCompany();
  }

  async toplevel() {
    const { ctx, service } = this;

    ctx.body = await service.companyArea.findToplevelByCompany();
  }

  async update() {
    const { ctx, service } = this;

    ctx.body = await service.companyArea.updateById(ctx.request.body);
  }

  async updateOrder() {
    const { ctx, service } = this;

    ctx.body = await service.companyArea.updateOrder(ctx.request.body);
  }

  async delete() {
    const { ctx, service } = this;

    ctx.body = await service.companyArea.delete(ctx.request.body.id);
  }
}

module.exports = CompanyAreaController;
