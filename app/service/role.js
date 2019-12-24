/** *
 *
 * @author steephenliu
 * @date 2019-03-08
**/

'use strict';

const assert = require('assert');
const Service = require('egg').Service;


class RoleService extends Service {
  async findById(id) {
    const { tables } = this.config;
    const company = this.ctx.session.company;

    const role = await this.app.mysql.queryOne(`select * from ${tables.role} where id = ? and company = ? and is_deleted = 0;`, [ id, company ]);
    if (role) {
      role.permission = role.permission.split(',');
    }

    return this.ctx.helper.underlineToCamel(role);
  }

  async findIdsByCompany() {
    const { tables } = this.config;
    const company = this.ctx.session.company;

    const roles = await this.app.mysql.query(`select id from ${tables.role} where company = ? and is_deleted = 0;`, [ company ]);

    return new Set(roles.map(r => r.id));
  }


  async findByCompany() {
    const { tables } = this.config;
    const company = this.ctx.session.company;

    const roles = await this.app.mysql.query(`select * from ${tables.role} where company = ? and is_deleted = 0;`, [ company ]);

    return this.ctx.helper.underlineToCamel(roles);
  }

  async update(role) {
    const { tables } = this.config;
    const company = this.ctx.session.company;
    const permissions = this.service.permission.findAll();

    if (role.permission) {
      role.permission = Array.from(new Set(role.permission.split(',')))
        .map(r => r.trim())
        .filter(r => r in permissions.code)
        .join(',');
    } else {
      role.permission = '';
    }
    assert(role.name, '`name` cannot be empty.');

    let results;

    role.update_at = new Date();
    if (role.id) {
      assert(role.id !== 1, 'update error.');
      results = await this.app.mysql.query(`update ${tables.role} set name = ?, permission = ?, addition = ?, is_admin = ?, update_at = ? where id = ? and company = ? and is_deleted = 0`, [
        role.name,
        role.permission,
        role.addition,
        role.is_admin,
        role.update_at,
        role.id,
        company,
      ]);
    } else {
      results = await this.app.mysql.insert(tables.role, {
        company,
        name: role.name,
        permission: role.permission || '',
        addition: role.addition,
        is_admin: role.is_admin || 0,
        create_at: new Date(),
        update_at: new Date(),
        is_deleted: 0,
      });
    }
    return results;
  }

  async delete(id) {
    const { tables } = this.config;
    const company = this.ctx.session.company;

    return await this.app.mysql.query(`update ${tables.role} set is_deleted = 1 where id = ? and company = ? and is_deleted = 0`, [
      id, company,
    ]);
  }

  async updateRelation(table, owner, ownerCol, relations, relationCol) {
    // assert(Array.isArray(relations), '`users` must be an array.');
    // assert(relations.length > 0, 'please select users.');

    // const roleIdSet = await this.findIdsByCompany();
    // assert(roleIdSet.has(owner), 'role doesn\'t exist.');

    const existRelationTable = await this.app.mysql.query(
      `select ${relationCol} from ${table} where ${ownerCol} = ? and ${relationCol} in (${this.helper.arrayQuery(relations.length)})`,
      [ owner, ...relations ]
    );

    const existRelation = existRelationTable.map(r => r[relationCol]);
    const existsRelationSet = new Set(existRelation);
    const submitRelationSet = new Set(relations);

    const needToInsert = relations.filter(u => !existsRelationSet.has(u));
    const needToDelete = existRelationTable.filter(r => !submitRelationSet.has(r[relationCol])).map(r => r.id);

    if (needToInsert.length > 0) {
      // 插入
      return await this.app.mysql.insert(table, needToInsert.map(u => {
        const row = {};
        row[ownerCol] = owner;
        row[relationCol] = u;
        row.create_at = new Date();
        return row;
      }));
    }

    if (needToDelete.length > 0) {
      await this.app.mysql.query(`delete from ${table} where id in (${this.helper.arrayQuery(needToDelete.length)})`, needToDelete);
    }
  }

  async authorize(role, users) {
    //
    const { tables } = this.config;

    assert(Array.isArray(users), '`users` must be an array.');
    assert(users.length > 0, 'please select users.');

    const roleIdSet = await this.findIdsByCompany();
    assert(roleIdSet.has(role), 'role doesn\'t exist.');

    await this.updateRelation(tables.userRole, role, 'role', users, 'user');
    return {};
  }

  async loginUserPermission() {
    const { tables } = this.config;
    const loginUser = this.ctx.session.user;
    const company = this.ctx.session.company;

    const curRoles = await this.app.mysql.query(
      `select r.permission,r.is_admin from ${tables.userRole} ur left join ${tables.role} r on ur.role = r.id where ur.user = ? and r.company = ? and r.is_deleted = 0`,
      [ loginUser.id, company ]
    );

    const codes = new Set(curRoles.map(i => i.permission).join(',').split(','));
    const isAdmin = curRoles.some(i => i.is_admin === 1);

    return {
      codes,
      isAdmin,
    };
  }

  async updateUserRole(userId, roles) {
    const { tables } = this.config;

    const roleIdSet = await this.findIdsByCompany();
    roles = roles.filter(r => roleIdSet.has(r));

    this.updateRelation(tables.userRole, userId, 'user', roles, 'role');
    return {};
  }

}

module.exports = RoleService;
