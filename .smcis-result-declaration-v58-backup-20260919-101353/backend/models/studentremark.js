module.exports = (sequelize, DataTypes) => {
  const StudentRemark = sequelize.define(
    "StudentRemark",
    {
      student_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      session_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      class_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      section_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      term_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      remark: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: "StudentRemarks", // change only if your actual table name is different
    }
  );

  StudentRemark.associate = (models) => {
    StudentRemark.belongsTo(models.Student, {
      foreignKey: "student_id",
      as: "student",
    });

    StudentRemark.belongsTo(models.Session, {
      foreignKey: "session_id",
      as: "session",
    });

    StudentRemark.belongsTo(models.Class, {
      foreignKey: "class_id",
      as: "class",
    });

    StudentRemark.belongsTo(models.Section, {
      foreignKey: "section_id",
      as: "section",
    });

    StudentRemark.belongsTo(models.Term, {
      foreignKey: "term_id",
      as: "term",
    });
  };

  return StudentRemark;
};