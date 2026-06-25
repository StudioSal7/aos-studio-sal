import { relations } from 'drizzle-orm';
import { commercialAnalyses } from './commercial-analyses';
import { formFields } from './form-fields';
import { formResponses } from './form-responses';
import { forms } from './forms';
import { leadActionLog } from './lead-action-log';
import { leadFieldAudit } from './lead-field-audit';
import { leadIntakeLog } from './lead-intake-log';
import { leadLossReasons } from './lead-loss-reasons';
import { leadSources } from './lead-sources';
import { leadStageHistory } from './lead-stage-history';
import { leadStages } from './lead-stages';
import { leads } from './leads';
import { meetings } from './meetings';
import { products } from './products';
import { roleplayMessages } from './roleplay-messages';
import { roleplayScenarios } from './roleplay-scenarios';
import { roleplaySessions } from './roleplay-sessions';
import { users } from './users';

export const leadsRelations = relations(leads, ({ one, many }) => ({
  stage: one(leadStages, {
    fields: [leads.stageId],
    references: [leadStages.id],
  }),
  source: one(leadSources, {
    fields: [leads.leadSourceId],
    references: [leadSources.id],
  }),
  produtoInteresse: one(products, {
    fields: [leads.produtoInteresseId],
    references: [products.id],
  }),
  motivoPerda: one(leadLossReasons, {
    fields: [leads.motivoPerdaId],
    references: [leadLossReasons.id],
  }),
  sdr: one(users, {
    fields: [leads.sdrId],
    references: [users.id],
    relationName: 'sdrLeads',
  }),
  closer: one(users, {
    fields: [leads.closerId],
    references: [users.id],
    relationName: 'closerLeads',
  }),
  meetings: many(meetings),
  stageHistory: many(leadStageHistory),
  fieldAudit: many(leadFieldAudit),
  actionLog: many(leadActionLog),
  intakeLog: many(leadIntakeLog),
  commercialAnalyses: many(commercialAnalyses),
  roleplaySessions: many(roleplaySessions),
  formResponses: many(formResponses),
}));

export const formsRelations = relations(forms, ({ many }) => ({
  fields: many(formFields),
  responses: many(formResponses),
}));

export const formFieldsRelations = relations(formFields, ({ one }) => ({
  form: one(forms, {
    fields: [formFields.formId],
    references: [forms.id],
  }),
}));

export const formResponsesRelations = relations(formResponses, ({ one }) => ({
  form: one(forms, {
    fields: [formResponses.formId],
    references: [forms.id],
  }),
  lead: one(leads, {
    fields: [formResponses.leadId],
    references: [leads.id],
  }),
}));

export const commercialAnalysesRelations = relations(commercialAnalyses, ({ one }) => ({
  lead: one(leads, {
    fields: [commercialAnalyses.leadId],
    references: [leads.id],
  }),
  createdByUser: one(users, {
    fields: [commercialAnalyses.createdBy],
    references: [users.id],
  }),
}));

export const roleplayScenariosRelations = relations(roleplayScenarios, ({ many }) => ({
  sessions: many(roleplaySessions),
}));

export const roleplaySessionsRelations = relations(roleplaySessions, ({ one, many }) => ({
  scenario: one(roleplayScenarios, {
    fields: [roleplaySessions.scenarioId],
    references: [roleplayScenarios.id],
  }),
  lead: one(leads, {
    fields: [roleplaySessions.leadId],
    references: [leads.id],
  }),
  messages: many(roleplayMessages),
}));

export const roleplayMessagesRelations = relations(roleplayMessages, ({ one }) => ({
  session: one(roleplaySessions, {
    fields: [roleplayMessages.sessionId],
    references: [roleplaySessions.id],
  }),
}));

export const meetingsRelations = relations(meetings, ({ one }) => ({
  lead: one(leads, {
    fields: [meetings.leadId],
    references: [leads.id],
  }),
}));

export const leadStageHistoryRelations = relations(leadStageHistory, ({ one }) => ({
  lead: one(leads, {
    fields: [leadStageHistory.leadId],
    references: [leads.id],
  }),
  fromStage: one(leadStages, {
    fields: [leadStageHistory.fromStageId],
    references: [leadStages.id],
    relationName: 'fromStage',
  }),
  toStage: one(leadStages, {
    fields: [leadStageHistory.toStageId],
    references: [leadStages.id],
    relationName: 'toStage',
  }),
  changedByUser: one(users, {
    fields: [leadStageHistory.changedBy],
    references: [users.id],
  }),
}));

export const leadFieldAuditRelations = relations(leadFieldAudit, ({ one }) => ({
  lead: one(leads, {
    fields: [leadFieldAudit.leadId],
    references: [leads.id],
  }),
  changedByUser: one(users, {
    fields: [leadFieldAudit.changedBy],
    references: [users.id],
  }),
}));

export const leadActionLogRelations = relations(leadActionLog, ({ one }) => ({
  lead: one(leads, {
    fields: [leadActionLog.leadId],
    references: [leads.id],
  }),
  setByUser: one(users, {
    fields: [leadActionLog.setBy],
    references: [users.id],
    relationName: 'actionsSet',
  }),
  completedByUser: one(users, {
    fields: [leadActionLog.completedBy],
    references: [users.id],
    relationName: 'actionsCompleted',
  }),
}));

export const leadIntakeLogRelations = relations(leadIntakeLog, ({ one }) => ({
  lead: one(leads, {
    fields: [leadIntakeLog.leadId],
    references: [leads.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  sdrLeads: many(leads, { relationName: 'sdrLeads' }),
  closerLeads: many(leads, { relationName: 'closerLeads' }),
}));
