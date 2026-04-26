import {
  type MigrationInterface,
  type QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreatePasskey1777217712285 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'passkey',
        columns: [
          {
            name: 'id',
            type: 'text',
            isPrimary: true,
          },
          {
            name: 'name',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'publicKey',
            type: 'text',
          },
          {
            name: 'userId',
            type: 'text',
          },
          {
            name: 'credentialID',
            type: 'text',
          },
          {
            name: 'counter',
            type: 'integer',
          },
          {
            name: 'deviceType',
            type: 'text',
          },
          {
            name: 'backedUp',
            type: 'boolean',
          },
          {
            name: 'transports',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'aaguid',
            type: 'text',
            isNullable: true,
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'passkey',
      new TableIndex({
        name: 'passkey_userId_idx',
        columnNames: ['userId'],
      }),
    );

    await queryRunner.createForeignKey(
      'passkey',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'passkey',
      new TableIndex({
        name: 'passkey_credentialID_idx',
        columnNames: ['credentialID'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('passkey');
  }
}
