import {
  Column,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { OldPasswordResetTokens } from './OldPasswordResetTokens';
import { IntBaseEntity } from '../base/BaseEntity';
import { Settings } from '../system/Settings';
import { Trips } from '../trip/Trips';
import { Categories } from '../trip/Categories';
import { Tags } from '../trip/Tags';
import { TripFiles } from '../trip/files/TripFiles';
import { BudgetItems } from '../trip/budget/BudgetItems';
import { VacayPlans } from '../vacay/VacayPlans';
import { TripMembers } from '../trip/TripMembers';
import { VacayPlanMembers } from '../vacay/VacayPlanMembers';
import { VacayUserColors } from '../vacay/VacayUserColors';
import { VacayUserYears } from '../vacay/VacayUserYears';
import { VacayEntries } from '../vacay/VacayEntries';
import { CollabNotes } from '../trip/collab/CollabNotes';
import { CollabPolls } from '../trip/collab/CollabPolls';
import { CollabPollVotes } from '../trip/collab/CollabPollVotes';
import { CollabMessages } from '../trip/collab/CollabMessages';
import { AssignmentParticipants } from '../trip/AssignmentParticipants';
import { AuditLog } from '../system/AuditLog';
import { Notifications } from '../notification/Notifications';
import { NotificationChannelPreferences } from '../notification/NotificationChannelPreferences';
import { BudgetItemMembers } from '../trip/budget/BudgetItemMembers';
import { CollabMessageReactions } from '../trip/collab/CollabMessageReactions';
import { InviteTokens } from '../system/InviteTokens';
import { PackingCategoryAssignees } from '../trip/lists/PackingCategoryAssignees';
import { PackingTemplates } from '../trip/lists/PackingTemplates';
import { PackingBags } from '../trip/lists/PackingBags';
import { VisitedCountries } from '../atlas/VisitedCountries';
import { BucketList } from '../atlas/BucketList';
import { ShareTokens } from '../trip/ShareTokens';
import { McpTokens } from '../mcp/McpTokens';
import { TripAlbumLinks } from '../trip/journey/TripAlbumLinks';
import { TodoItems } from '../trip/lists/TodoItems';
import { TodoCategoryAssignees } from '../trip/lists/TodoCategoryAssignees';
import { VisitedRegions } from '../atlas/VisitedRegions';
import { OldOauthConsents } from './OldOauthConsents';
import { OldOauthTokens } from './OldOauthTokens';
import { Journeys } from '../trip/journey/Journeys';
import { JourneyEntries } from '../trip/journey/JourneyEntries';
import { JourneyContributors } from '../trip/journey/JourneyContributors';
import { JourneyShareTokens } from '../trip/journey/JourneyShareTokens';
import { TrekPhotos } from '../trip/journey/TrekPhotos';
import { TripPhotos } from '../trip/TripPhotos';
import { UserNoticeDismissals } from '../system/UserNoticeDismissals';
import { IdempotencyKeys } from '../system/IdempotencyKeys';
import { OldOauthClients } from './OldOauthClients';

@Index('idx_users_email', ['email'], {})
@Entity('users')
export class SqliteUsers extends IntBaseEntity {
  @Column({ name: 'username', unique: true })
  username: string;

  @Column({ name: 'email', unique: true })
  email: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ name: 'role', default: 'user' })
  role: string;

  @Column({ name: 'maps_api_key', nullable: true })
  mapsApiKey: string | null;

  @Column({ name: 'unsplash_api_key', nullable: true })
  unsplashApiKey: string | null;

  @Column({ name: 'openweather_api_key', nullable: true })
  openweatherApiKey: string | null;

  @Column({ name: 'avatar', nullable: true })
  avatar: string | null;

  @Column({ name: 'oidc_sub', nullable: true })
  oidcSub: string | null;

  @Column({ name: 'oidc_issuer', nullable: true })
  oidcIssuer: string | null;

  @Column({ name: 'last_login', nullable: true })
  lastLogin: Date | null;

  @Column({
    name: 'mfa_enabled',
    default: false,
  })
  mfaEnabled: boolean;

  @Column({ name: 'mfa_secret', nullable: true })
  mfaSecret: string | null;

  @Column({ name: 'mfa_backup_codes', nullable: true })
  mfaBackupCodes: string | null;

  @Column({ name: 'immich_url', nullable: true })
  immichUrl: string | null;

  @Column({ name: 'immich_access_token', nullable: true })
  immichAccessToken: string | null;

  @Column({ name: 'synology_url', nullable: true })
  synologyUrl: string | null;

  @Column({ name: 'synology_username', nullable: true })
  synologyUsername: string | null;

  @Column({ name: 'synology_password', nullable: true })
  synologyPassword: string | null;

  @Column({ name: 'synology_sid', nullable: true })
  synologySid: string | null;

  @Column({
    name: 'must_change_password',
    default: false,
  })
  mustChangePassword: boolean;

  @Column('int', { name: 'password_version', default: 0 })
  passwordVersion: number;

  @Column({ name: 'immich_api_key', nullable: true })
  immichApiKey: string | null;

  @Column({ name: 'synology_skip_ssl', default: false })
  synologySkipSsl: boolean;

  @Column({ name: 'synology_did', nullable: true })
  synologyDid: string | null;

  @Column('text', { name: 'first_seen_version', default: '0.0.0' })
  firstSeenVersion: string;

  @Column('int', { name: 'login_count', default: 0 })
  loginCount: number;

  @Column({ name: 'immich_auto_upload', default: false })
  immichAutoUpload: boolean;

  @OneToMany(
    () => OldPasswordResetTokens,
    (passwordResetTokens) => passwordResetTokens.user,
  )
  passwordResetTokens: OldPasswordResetTokens[];

  @OneToMany(() => Settings, (settings) => settings.user)
  settings: Settings[];

  @OneToMany(() => Trips, (trips) => trips.user)
  trips: Trips[];

  @OneToMany(() => Categories, (categories) => categories.user)
  categories: Categories[];

  @OneToMany(() => Tags, (tags) => tags.user)
  tags: Tags[];

  @OneToMany(() => TripFiles, (tripFiles) => tripFiles.uploadedBy)
  tripFiles: TripFiles[];

  @OneToMany(() => TripMembers, (tripMembers) => tripMembers.invitedBy)
  tripMembers: TripMembers[];

  @OneToMany(() => TripMembers, (tripMembers) => tripMembers.user)
  tripMembers2: TripMembers[];

  @OneToMany(() => BudgetItems, (budgetItems) => budgetItems.paidByUser)
  budgetItems: BudgetItems[];

  @OneToOne(() => VacayPlans, (vacayPlans) => vacayPlans.owner)
  vacayPlans: VacayPlans;

  @OneToMany(
    () => VacayPlanMembers,
    (vacayPlanMembers) => vacayPlanMembers.user,
  )
  vacayPlanMembers: VacayPlanMembers[];

  @OneToMany(() => VacayUserColors, (vacayUserColors) => vacayUserColors.user)
  vacayUserColors: VacayUserColors[];

  @OneToMany(() => VacayUserYears, (vacayUserYears) => vacayUserYears.user)
  vacayUserYears: VacayUserYears[];

  @OneToMany(() => VacayEntries, (vacayEntries) => vacayEntries.user)
  vacayEntries: VacayEntries[];

  @OneToMany(() => CollabNotes, (collabNotes) => collabNotes.user)
  collabNotes: CollabNotes[];

  @OneToMany(() => CollabPolls, (collabPolls) => collabPolls.user)
  collabPolls: CollabPolls[];

  @OneToMany(() => CollabPollVotes, (collabPollVotes) => collabPollVotes.user)
  collabPollVotes: CollabPollVotes[];

  @OneToMany(() => CollabMessages, (collabMessages) => collabMessages.user)
  collabMessages: CollabMessages[];

  @OneToMany(
    () => AssignmentParticipants,
    (assignmentParticipants) => assignmentParticipants.user,
  )
  assignmentParticipants: AssignmentParticipants[];

  @OneToMany(() => AuditLog, (auditLog) => auditLog.user)
  auditLogs: AuditLog[];

  @OneToMany(() => Notifications, (notifications) => notifications.recipient)
  notifications: Notifications[];

  @OneToMany(() => Notifications, (notifications) => notifications.sender)
  notifications2: Notifications[];

  @OneToMany(
    () => NotificationChannelPreferences,
    (notificationChannelPreferences) => notificationChannelPreferences.user,
  )
  notificationChannelPreferences: NotificationChannelPreferences[];

  @OneToMany(
    () => BudgetItemMembers,
    (budgetItemMembers) => budgetItemMembers.user,
  )
  budgetItemMembers: BudgetItemMembers[];

  @OneToMany(
    () => CollabMessageReactions,
    (collabMessageReactions) => collabMessageReactions.user,
  )
  collabMessageReactions: CollabMessageReactions[];

  @OneToMany(() => InviteTokens, (inviteTokens) => inviteTokens.createdBy)
  inviteTokens: InviteTokens[];

  @OneToMany(
    () => PackingCategoryAssignees,
    (packingCategoryAssignees) => packingCategoryAssignees.user,
  )
  packingCategoryAssignees: PackingCategoryAssignees[];

  @OneToMany(
    () => PackingTemplates,
    (packingTemplates) => packingTemplates.createdBy,
  )
  packingTemplates: PackingTemplates[];

  @OneToMany(() => PackingBags, (packingBags) => packingBags.user)
  packingBags: PackingBags[];

  @OneToMany(
    () => VisitedCountries,
    (visitedCountries) => visitedCountries.user,
  )
  visitedCountries: VisitedCountries[];

  @OneToMany(() => BucketList, (bucketList) => bucketList.user)
  bucketLists: BucketList[];

  @OneToMany(() => ShareTokens, (shareTokens) => shareTokens.createdBy)
  shareTokens: ShareTokens[];

  @OneToMany(() => McpTokens, (mcpTokens) => mcpTokens.user)
  mcpTokens: McpTokens[];

  @OneToMany(() => TripAlbumLinks, (tripAlbumLinks) => tripAlbumLinks.user)
  tripAlbumLinks: TripAlbumLinks[];

  @OneToMany(() => TodoItems, (todoItems) => todoItems.assignedUser)
  todoItems: TodoItems[];

  @OneToMany(
    () => TodoCategoryAssignees,
    (todoCategoryAssignees) => todoCategoryAssignees.user,
  )
  todoCategoryAssignees: TodoCategoryAssignees[];

  @OneToMany(() => VisitedRegions, (visitedRegions) => visitedRegions.user)
  visitedRegions: VisitedRegions[];

  @ManyToMany(() => PackingBags, (packingBags) => packingBags.users)
  @JoinTable({
    name: 'packing_bag_members',
    joinColumns: [{ name: 'user_id', referencedColumnName: 'id' }],
    inverseJoinColumns: [{ name: 'bag_id', referencedColumnName: 'id' }],
  })
  packingBags2: PackingBags[];

  @OneToMany(() => OldOauthConsents, (oauthConsents) => oauthConsents.user)
  oauthConsents: OldOauthConsents[];

  @OneToMany(() => OldOauthTokens, (oauthTokens) => oauthTokens.user)
  oauthTokens: OldOauthTokens[];

  @OneToMany(() => Journeys, (journeys) => journeys.user)
  journeys: Journeys[];

  @OneToMany(() => JourneyEntries, (journeyEntries) => journeyEntries.author)
  journeyEntries: JourneyEntries[];

  @OneToMany(
    () => JourneyContributors,
    (journeyContributors) => journeyContributors.user,
  )
  journeyContributors: JourneyContributors[];

  @OneToMany(
    () => JourneyShareTokens,
    (journeyShareTokens) => journeyShareTokens.createdBy,
  )
  journeyShareTokens: JourneyShareTokens[];

  @OneToMany(() => TrekPhotos, (trekPhotos) => trekPhotos.owner)
  trekPhotos: TrekPhotos[];

  @OneToMany(() => TripPhotos, (tripPhotos) => tripPhotos.user)
  tripPhotos: TripPhotos[];

  @OneToMany(
    () => UserNoticeDismissals,
    (userNoticeDismissals) => userNoticeDismissals.user,
  )
  userNoticeDismissals: UserNoticeDismissals[];

  @OneToMany(() => IdempotencyKeys, (idempotencyKeys) => idempotencyKeys.user)
  idempotencyKeys: IdempotencyKeys[];

  @OneToMany(() => OldOauthClients, (oauthClients) => oauthClients.user)
  oauthClients: OldOauthClients[];
}
