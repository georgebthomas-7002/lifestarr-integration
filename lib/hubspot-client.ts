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
 * Properties applied only on contact CREATE — never on update — so we don't
 * clobber legitimate ownership on contacts that already exist in HubSpot.
 *
 * Properties NOT set here, with reasoning:
 *
 * - `hs_latest_source` / `hs_latest_source_data_2` / `hs_object_source_detail_1`
 *   are READ_ONLY in the CRM API — HubSpot derives them automatically from
 *   the calling Private App's identity. With Zapier disabled, new contacts
 *   auto-attribute to our Private App. To change the displayed label,
 *   rename the Private App in HubSpot Settings → Integrations → Private Apps.
 *
 * - `hs_marketable_status` (Marketing Contact toggle) is managed by HubSpot
 *   internally — the property is `readOnlyValue: true` and the dedicated
 *   marketing-contacts API endpoints return 404 in this account. The proper
 *   way to flip new contacts to Marketing Contact is a HubSpot Workflow:
 *     trigger: `lifestarr_central_account_created` is true
 *     action:  Set marketing contact status → Marketing
 *   See docs/property-mapping-audit-2026-05-07.md for context.
 */
function buildCreateOnlyProps(): Record<string, string> {
  const props: Record<string, string> = {};
  const ownerId = process.env.HUBSPOT_DEFAULT_CONTACT_OWNER_ID;
  if (ownerId) props.hubspot_owner_id = ownerId;
  return props;
}

let _client: Client | null = null;

function getClient(): Client {
  if (_client) return _client;
  const token = process.env.HUBSPOT_API_TOKEN;
  if (!token) {
    throw new Error("HUBSPOT_API_TOKEN is not set");
  }
  // numberOfApiCallRetries lets the SDK absorb 429 rate-limit spikes
  // (e.g. Mighty backfill bursts) by retrying with HubSpot's Retry-After header.
  // Six retries with exponential backoff is enough to ride out a typical burst.
  _client = new Client({ accessToken: token, numberOfApiCallRetries: 6 });
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

export async function findContactByMightyMemberId(
  mightyMemberId: string | number,
): Promise<SimplePublicObject | null> {
  try {
    const search: PublicObjectSearchRequest = {
      filterGroups: [
        {
          filters: [
            {
              propertyName: "mighty_member_id",
              operator: FilterOperatorEnum.Eq,
              value: String(mightyMemberId),
            },
          ],
        },
      ],
      properties: [
        "email",
        "mighty_member_id",
        "lifestarr_active_spaces",
        "lifestarr_spaces",
        "lifestarr_space_membership_count",
      ],
      limit: 1,
      sorts: [],
      after: "0",
    };
    const res = await getClient().crm.contacts.searchApi.doSearch(search);
    return res.results[0] ?? null;
  } catch (err) {
    throw new HubSpotClientError(`findContactByMightyMemberId(${mightyMemberId})`, err);
  }
}

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
        "lifestarr_active_spaces",
        "lifestarr_spaces",
        "lifestarr_space_membership_count",
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
  if (input.lifestarr_profile_bio !== undefined) {
    props.lifestarr_profile_bio = input.lifestarr_profile_bio ?? "";
  }
  if (input.lifestarr_location !== undefined) {
    props.lifestarr_location = input.lifestarr_location ?? "";
  }
  if (input.lifestarr_timezone !== undefined) {
    props.lifestarr_timezone = input.lifestarr_timezone ?? "";
  }
  if (input.lifestarr_profile_image_url !== undefined) {
    props.lifestarr_profile_image_url = input.lifestarr_profile_image_url ?? "";
  }
  if (input.lifestarr_mighty_profile_url !== undefined) {
    props.lifestarr_mighty_profile_url = input.lifestarr_mighty_profile_url;
  }
  if (input.lifestarr_referral_count !== undefined) {
    props.lifestarr_referral_count = String(input.lifestarr_referral_count);
  }
  if (input.lifestarr_active_spaces !== undefined) {
    props.lifestarr_active_spaces = input.lifestarr_active_spaces;
  }
  if (input.lifestarr_spaces !== undefined) {
    props.lifestarr_spaces = input.lifestarr_spaces;
  }
  if (input.lifestarr_last_space_joined_at !== undefined) {
    props.lifestarr_last_space_joined_at = input.lifestarr_last_space_joined_at;
  }
  if (input.lifestarr_last_space_left_at !== undefined) {
    props.lifestarr_last_space_left_at = input.lifestarr_last_space_left_at;
  }
  if (input.lifestarr_space_membership_count !== undefined) {
    props.lifestarr_space_membership_count = String(input.lifestarr_space_membership_count);
  }
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

/**
 * @param input - the contact properties to set
 * @param prefetchedExisting - if the caller already looked up the contact via
 *   findContactByEmail, pass the result here to avoid a second search round-trip.
 *   Pass `null` if you've already verified the contact doesn't exist.
 *   Omit (or `undefined`) to have upsertContact do the search itself.
 */
export async function upsertContact(
  input: ContactInput,
  prefetchedExisting?: SimplePublicObject | null,
): Promise<UpsertResult> {
  const existing =
    prefetchedExisting === undefined ? await findContactByEmail(input.email) : prefetchedExisting;
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
      properties: { ...properties, ...buildCreateOnlyProps() },
      associations: [],
    };
    const created = await getClient().crm.contacts.basicApi.create(payload);
    return { contact: created, created: true };
  } catch (err) {
    // Race condition: a parallel handler invocation for the same email won the
    // create-race a few ms before us. HubSpot 400s with "Contact already exists".
    // Re-search and fall through to the update path so this event lands cleanly
    // instead of bouncing as failed.
    if (isAlreadyExistsError(err)) {
      const racy = await findContactByEmail(input.email);
      if (racy) {
        try {
          const updated = await getClient().crm.contacts.basicApi.update(racy.id, {
            properties,
          });
          return { contact: updated, created: false };
        } catch (updateErr) {
          throw new HubSpotClientError(`upsertContact.update-after-race(${racy.id})`, updateErr);
        }
      }
    }
    throw new HubSpotClientError(`upsertContact.create(${input.email})`, err);
  }
}

function isAlreadyExistsError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const code = (err as { code?: number }).code;
  if (code !== 409 && code !== 400) return false;
  const body = (err as { body?: { message?: string; category?: string } }).body;
  const msg = (body?.message ?? "").toLowerCase();
  const cat = (body?.category ?? "").toLowerCase();
  return (
    msg.includes("already exists") ||
    msg.includes("contact already exists") ||
    cat === "conflict" ||
    cat === "object_already_exists"
  );
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
