-- Create role_permissions table to map users to stores they can access
-- This table is used for employee store access management

CREATE TABLE IF NOT EXISTS public.role_permissions (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    store_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT role_permissions_pkey PRIMARY KEY (id),
    CONSTRAINT role_permissions_user_id_fkey FOREIGN KEY (user_id) 
        REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT role_permissions_store_id_fkey FOREIGN KEY (store_id) 
        REFERENCES public.stores(id) ON DELETE CASCADE,
    CONSTRAINT role_permissions_user_store_unique UNIQUE (user_id, store_id)
) TABLESPACE pg_default;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_role_permissions_user_id 
    ON public.role_permissions USING btree (user_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_role_permissions_store_id 
    ON public.role_permissions USING btree (store_id) TABLESPACE pg_default;

