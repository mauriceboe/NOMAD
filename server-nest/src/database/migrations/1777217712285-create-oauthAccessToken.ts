import {
  type MigrationInterface,
  type QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateOauthAccessToken1777217712285 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'oauthAccessToken',
        columns: [
          {
            name: 'id',
            type: 'text',
            isPrimary: true,
          },
          {
            name: 'accessToken',
            type: 'text',
            isNullable: true,
            isUnique: true,
          },
          {
            name: 'refreshToken',
            type: 'text',
            isNullable: true,
            isUnique: true,
          },
          {
            name: 'accessTokenExpiresAt',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'refreshTokenExpiresAt',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'clientId',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'userId',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'scopes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'updatedAt',
            type: 'datetime',
            isNullable: true,
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'oauthAccessToken',
      new TableIndex({
        name: 'oauthAccessToken_clientId_idx',
        columnNames: ['clientId'],
      }),
    );

    await queryRunner.createForeignKey(
      'oauthAccessToken',
      new TableForeignKey({
        columnNames: ['clientId'],
        referencedTableName: 'oauthApplication',
        referencedColumnNames: ['clientId'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'oauthAccessToken',
      new TableIndex({
        name: 'oauthAccessToken_userId_idx',
        columnNames: ['userId'],
      }),
    );

    await queryRunner.createForeignKey(
      'oauthAccessToken',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('oauthAccessToken');
  }
}
