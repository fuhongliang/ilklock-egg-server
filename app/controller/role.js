'use strict';

const Controller = require('egg').Controller;

class RoleController extends Controller {
  // 列表
  async index() {
    const { ctx, service } = this;

    const roles = await service.role.findByCompany();

    ctx.body = roles;
  }

  // 插入或更新
  async update() {
    //
    const { ctx, service } = this;

    ctx.body = await service.role.insertOrUpdate(ctx.request.body);
  }

  // 删除
  async delete() {
    const { ctx, service } = this;

    ctx.body = await service.role.delete(ctx.request.body.id);
  }

  async authorize() {
    const { ctx, service } = this;

    ctx.body = await service.role.authorize(ctx.request.body.role, ctx.request.body.users);
  }
}

module.exports = RoleController;
