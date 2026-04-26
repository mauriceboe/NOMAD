import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule as BetterAuthNestModule } from '@thallesp/nestjs-better-auth';
import { DataSource } from 'typeorm';
import { createAuth } from './auth.factory.js';
import { AuthConfig } from '../config/auth.config.js';
import { User } from '../models/entities/auth/User.js';
import { Account } from '../models/entities/auth/Account.js';
import { Session } from '../models/entities/auth/Session.js';
import { Verification } from '../models/entities/auth/Verification.js';
import { Passkey } from '../models/entities/auth/Passkey.js';
import { Jwks } from '../models/entities/auth/Jwks.js';
import { OauthClient } from '../models/entities/auth/OauthClient.js';
import { OauthAccessToken } from '../models/entities/auth/OauthAccessToken.js';
import { OauthRefreshToken } from '../models/entities/auth/OauthRefreshToken.js';
import { OauthConsent } from '../models/entities/auth/OauthConsent.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Account,
      Session,
      Verification,
      Passkey,
      Jwks,
      OauthClient,
      OauthAccessToken,
      OauthRefreshToken,
      OauthConsent,
    ]),
    BetterAuthNestModule.forRootAsync({
      imports: [ConfigModule],
      inject: [DataSource, ConfigService],
      useFactory: (ds: DataSource, config: ConfigService) => ({
        auth: createAuth(ds, config.get<AuthConfig>('auth')!),
      }),
    }),
  ],
  exports: [BetterAuthNestModule],
})
export class AuthModule {}
