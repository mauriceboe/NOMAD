import authConfig from './config/auth.config.js';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module.js';

type SupportedDbType = 'mysql' | 'mariadb' | 'postgres' | 'sqlite';

function resolveDriver(type: SupportedDbType) {
  switch (type) {
    case 'mysql':
    case 'mariadb':
      return require('mysql2');
    case 'postgres':
      return require('pg');
    case 'sqlite':
      return require('better-sqlite3');
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [authConfig] }),
    AuthModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const type = config.get<SupportedDbType>('DB_TYPE', 'sqlite');

        return {
          type,
          driver: resolveDriver(type),
          host: config.get<string>('DB_HOST', 'localhost'),
          port: config.get<number>('DB_PORT', 5432),
          username: config.get<string>('DB_USER', 'usr'),
          password: config.get<string>('DB_PASS', 'pwd'),
          database: config.get<string>('DB_NAME', 'data/travel.db'),
          autoLoadEntities: true,
          synchronize: config.get<string>('NODE_ENV') !== 'production',
        };
      },
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
