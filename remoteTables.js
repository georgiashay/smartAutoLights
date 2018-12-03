const Sequelize = require("sequelize");
const mysql = require("mysql");
const mysqlAuth = require("./remoteMysqlAuth.json");

const sequelize = new Sequelize('smartlights', mysqlAuth.user, mysqlAuth.password, {
  host: mysqlAuth.host,
  dialect: 'mysql',

  omitNull: true,

  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },

  dialectOptions: {
    dateStrings: true
  },
  // http://docs.sequelizejs.com/manual/tutorial/querying.html#operators
  operatorsAliases: false
});

const Light = sequelize.define("light", {
  object_id: {type: Sequelize.STRING, primaryKey: true},
  object_type: Sequelize.STRING,
  name: Sequelize.STRING,
  state: Sequelize.BOOLEAN
});

const StateChange = sequelize.define("state_change", {
  object_id: {
    type: Sequelize.STRING,
    references: {
      model: Light,
      key: "object_id"
    }
  },
  newState: Sequelize.BOOLEAN,
  date: {
    type: "DATETIME"
  }
});

sequelize.sync();

module.exports = {sequelize: sequelize, Light: Light, StateChange: StateChange};
