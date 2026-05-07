import { Client } from "@hubspot/api-client";
import {
  FilterOperatorEnum,
  type PublicObjectSearchRequest,
  type SimplePublicObject,
  type SimplePublicObjectInputForCreate,
} from "@hubspot/api-client/lib/codegen/crm/contacts";
import { AssociationSpecAssociationCategoryEnum } from "@hubspot/api-client/lib/codegen/crm/deals";

import type { LifestarrContactProps } from "@/lib/hubspot-properties";

/**
 * Tag contacts that this integration creates with our own attribution so
 * HubSpot's auto-detection doesn't mislabel them (it has been picking up
 * "Zapier" by default). Applied on CREATE only — never overwrite the
 * legitimate latest-source of contacts that already exist in HubSpot.
 */
const INTEGRATION_SOURCE_PROPS = {
  hs_latest_source: "INTEGRATION",
  hs_latest_source_data_2: "LifeStarr Integration",
} as const;

let _client: Client | null = null;

function getClient(): Client {
  if (_client) return _client;
  const token = process.env.HUBSPOT_API_TOKEN;
  if (!token) {
    throw new Error("HUBSPOT_API_TOKEN is not set");
  }
  _client = new Client({ accessToken: token });
  return _client;
}

export class HubSpotClientError extends Error {
  constructor(
    public readonly operation: string,
    cause: unknown,
  ) {
    const detail =
      cause instanceof Error
        ? cause.message
        : typeof cause === "object" && cause !== null && "message" in cause
          ? String((cause as { message: unknown }).message)
          : String(cause);
    super(`HubSpot ${operation} failed: ${detail}`);
    this.name = "HubSpotClientError";
    this.cause = cause;
  }
}

export type ContactInput = {
  email: string;
  firstName?: string;
  lastName?: string;
} & LifestarrContactProps;

export async function findContactByEmail(email: string): Promise<SimplePublicObject | null> {
  try {
    const search: PublicObjectSearchRequest = {
      filterGroups: [
        {
          filters: [
            { propertyName: "email", operator: FilterOperatorEnum.Eq, value: email },
          ],
        },
      ],
      properties: [
        "email",
        "firstname",
        "lastname",
        "mighty_member_id",
        "lifestarr_plan",
        "lifestarr_plan_status",
        "lifestarr_engagement_score",
        "mighty_match_status",
      ],
      limit: 1,
      sorts: [],
      after: "0",
    };
    const res = await getClient().crm.contacts.searchApi.doSearch(search);
    return res.results[0] ?? null;
  } catch (err) {
    throw new HubSpotClientError(`findContactByEmail(${email})`, err);
  }
}

function toHubspotProperties(input: Partial<ContactInput>): Record<string, string> {
  const props: Record<string, string> = {};
  if (input.email !== undefined) props.email = input.email;
  if (input.firstName !== undefined) props.firstname = input.firstName;
  if (input.lastName !== undefined) props.lastname = input.lastName;
  if (input.mighty_member_id !== undefined) props.mighty_member_id = input.mighty_member_id;
  if (input.lifestarr_plan !== undefined) props.lifestarr_plan = input.lifestarr_plan;
  if (input.lifestarr_plan_status !== undefined) {
    props.lifestarr_plan_status = input.lifestarr_plan_status;
  }
  if (input.lifestarr_central_intro_account_created_date !== undefined) {
    props.lifestarr_central_intro_account_created_date =
      input.lifestarr_central_intro_account_created_date;
  }
  if (input.lifestarr_central_account_created !== undefined) {
    props.lifestarr_central_account_created = String(input.lifestarr_central_account_created);
  }
  if (input.lifestarr_premier_start_date !== undefined) {
    props.lifestarr_premier_start_date = input.lifestarr_premier_start_date;
  }
  if (input.lifestarr_premier_renewal_date !== undefined) {
    props.lifestarr_premier_renewal_date = input.lifestarr_premier_renewal_date;
  }
  if (input.lifestarr_engagement_score !== undefined) {
    props.lifestarr_engagement_score = String(input.lifestarr_engagement_score);
  }
  if (input.lifestarr_premier_ready !== undefined) {
    props.lifestarr_premier_ready = String(input.lifestarr_premier_ready);
  }
  if (input.lifestarr_track !== undefined) props.lifestarr_track = input.lifestarr_track;
  if (input.mighty_match_status !== undefined) {
    props.mighty_match_status = input.mighty_match_status;
  }
  if (input.lifecyclestage !== undefined) {
    props.lifecyclestage = input.lifecyclestage;
  }
  return props;
}

export type UpsertResult = {
  contact: SimplePublicObject;
  created: boolean;
};

export async function upsertContact(input: ContactInput): Promise<UpsertResult> {
  const existing = await findContactByEmail(input.email);
  const properties = toHubspotProperties(input);

  if (existing) {
    try {
      const updated = await getClient().crm.contacts.basicApi.update(existing.id, {
        properties,
      });
      return { contact: updated, created: false };
    } catch (err) {
      throw new HubSpotClientError(`upsertContact.update(${existing.id})`, err);
    }
  }

  try {
    const payload: SimplePublicObjectInputForCreate = {
      properties: { ...properties, ...INTEGRATION_SOURCE_PROPS },
      associations: [],
    };
    const created = await getClient().crm.contacts.basicApi.create(payload);
    return { contact: created, created: true };
  } catch (err) {
    throw new HubSpotClientError(`upsertContact.create(${input.email})`, err);
  }
}

export async function updateContactProperties(
  contactId: string,
  properties: Record<string, string | number | boolean | null | undefined>,
): Promise<SimplePublicObject> {
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(properties)) {
    if (v === undefined || v === null) continue;
    cleaned[k] = typeof v === "string" ? v : String(v);
  }
  try {
    return await getClient().crm.contacts.basicApi.update(contactId, { properties: cleaned });
  } catch (err) {
    throw new HubSpotClientError(`updateContactProperties(${contactId})`, err);
  }
}

export type CreateDealInput = {
  contactId: string;
  dealName: string;
  amount: number | string;
  pipeline: string;
  stage: string;
  closeDate?: string;
  customProperties?: Record<string, string | number | boolean>;
};

export async function createDeal(input: CreateDealInput): Promise<SimplePublicObject> {
  const properties: Record<string, string> = {
    dealname: input.dealName,
    amount: String(input.amount),
    pipeline: input.pipeline,
    dealstage: input.stage,
  };
  if (input.closeDate) properties.closedate = input.closeDate;
  if (input.customProperties) {
    for (const [k, v] of Object.entries(input.customProperties)) {
      properties[k] = typeof v === "string" ? v : String(v);
    }
  }

  try {
    return await getClient().crm.deals.basicApi.create({
      properties,
      associations: [
        {
          to: { id: input.contactId },
          types: [
            {
              associationCategory: AssociationSpecAssociationCategoryEnum.HubspotDefined,
              associationTypeId: 3,
            },
          ],
        },
      ],
    });
  } catch (err) {
    throw new HubSpotClientError(`createDeal(${input.dealName})`, err);
  }
}

export type DealPipelineStage = { id: string; label: string; displayOrder: number };

export async function getDealPipelineStages(pipelineId: string): Promise<DealPipelineStage[]> {
  try {
    const pipeline = await getClient().crm.pipelines.pipelinesApi.getById("deals", pipelineId);
    return pipeline.stages.map((s) => ({
      id: s.id,
      label: s.label,
      displayOrder: s.displayOrder,
    }));
  } catch (err) {
    throw new HubSpotClientError(`getDealPipelineStages(${pipelineId})`, err);
  }
}
