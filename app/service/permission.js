/** *
 *
 * @author steephenliu
 * @date 2019-03-08
**/

'use strict';

const extend = require('extend');
const Service = require('egg').Service;

// eslint-disable-next-line no-unused-vars
const adminPermissionCode = {
  10001: { name: '管理公司信息', module: 'company' },
};

const permissionCode = {
  20001: { name: '管理公司区域', module: 'companyArea' },
  30001: { name: '管理人员信息', module: 'user' },
  40001: { name: '管理权限信息', module: 'permission' },
  50001: { name: '管理锁信息', module: 'lock' },
  60001: { name: '管理锁授权信息', module: 'unlockTask' },
};

const moduleNameToCode = {};
for (const code in permissionCode) {
  moduleNameToCode[permissionCode[code].module] = code;
}

class PermissionService extends Service {
  findAll() {
    return {
      code: extend(true, {}, permissionCode),
      module: extend(true, {}, moduleNameToCode),
    };
  }

  hasPermission(modulePath, permissions) {
    if (permissions.isAdmin) return true;

    return permissions.codes.has(moduleNameToCode[modulePath]);
  }
}

module.exports = PermissionService;
